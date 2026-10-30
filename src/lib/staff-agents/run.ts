import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { FREE_AI_MODEL } from '@/lib/ai-tools/run'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { openCohorts } from '@/lib/higher-ed/programs'
import { captureServerEvent } from '@/lib/posthog/server'
import { reserveStaffAgentCall } from './reserve'
import { agentSwitchedOn, isStaffAgentsOn } from './switch'
import { runCareerServicesAgent } from './career-services-run'
import { BRIEFS, runBrief } from './briefing-run'
import { buildOfferUserMessage, OFFER_MAX_TOKENS, OFFER_SYSTEM, parseOfferReply } from './rapid-response'

// The rapid-response agent: when a WARN notice is filed in an organization's own region and it has no offer yet, the agent writes the
// offer (title and sign-up page text) and saves it as a CLOSED offer in the organization's existing Rapid response list, marked as an
// agent draft. Staff read it and press Publish; nothing is public or sent until they do. Runs by itself, daily.

export const AGENT_CREATED_BY = 'agent:rapid-response'
const MAX_NOTICES_PER_RUN = 3
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export interface OrgRunResult { institutionId: string; drafted: number; skipped: number; capped: boolean }

export async function runRapidResponseAgent(institutionId: string, now = new Date()): Promise<OrgRunResult> {
  const result: OrgRunResult = { institutionId, drafted: 0, skipped: 0, capped: false }
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true, name: true, enabledFeatures: true, isSampleData: true } })
  if (!inst || inst.isSampleData || !agentSwitchedOn(inst.enabledFeatures, 'rapidResponse')) return result

  const [notices, cohorts] = await Promise.all([regionNotices(institutionId, now), openCohorts(institutionId, now)])
  // Only layoffs inside the organization's own counties; the whole-state fallback is for staff to browse, not for the agent to act on.
  const todo = notices.filter((n) => n.inRegion && !n.responseId).slice(0, MAX_NOTICES_PER_RUN)
  const programs = [...new Map(cohorts.map((c) => [c.programId, { id: c.programId, ...c.program }])).values()].slice(0, 3)
  if (!todo.length || !programs.length) return result

  for (const n of todo) {
    const slot = await reserveStaffAgentCall(institutionId, 'rapid_response')
    if (!slot.ok) { result.capped = true; break }
    try {
      const message = await getAnthropicClient().messages.create({
        model: FREE_AI_MODEL,
        max_tokens: OFFER_MAX_TOKENS,
        system: OFFER_SYSTEM,
        messages: [{
          role: 'user',
          content: buildOfferUserMessage({
            institutionName: inst.name, employerName: n.employer, place: [n.county, n.state].filter(Boolean).join(', ') || null,
            employees: n.employees, noticeDate: day(n.noticeDate),
            programs: programs.map((p) => ({ name: p.name, credential: p.credential, wioaEligible: p.wioaEligible })),
          }),
        }],
      })
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      const offer = parseOfferReply(text, n.employer)
      captureServerEvent(`staff-agent-${institutionId}`, 'staff_agent_rapid_response_drafted', {
        institutionId, warnNoticeId: n.id, usable: Boolean(offer),
        inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: FREE_AI_MODEL,
      })
      if (!offer) { result.skipped++; continue } // tokens were spent, so the slot stays used
      await prisma.rapidResponse.create({
        data: { institutionId, warnNoticeId: n.id, employerName: n.employer, title: offer.title, message: offer.message, programIds: programs.map((p) => p.id), isActive: false, createdBy: AGENT_CREATED_BY },
      })
      result.drafted++
    } catch (error) {
      console.error('Rapid response agent failed:', error instanceof Error ? error.message : error)
      await slot.release?.()
      result.skipped++
    }
  }
  return result
}

/** Every non-sample organization with the agent switched on. Does nothing while STAFF_AGENTS_ENABLED is off. */
export async function runStaffAgentsDaily(now = new Date()): Promise<{ enabled: boolean; orgs: number; drafted: number; capped: number }> {
  if (!isStaffAgentsOn()) return { enabled: false, orgs: 0, drafted: 0, capped: 0 }
  const agentKeys = ['rapidResponse', 'careerServices', ...BRIEFS.map((b) => b.key)]
  const insts = await prisma.institution.findMany({
    where: { isSampleData: false, OR: agentKeys.map((k) => ({ enabledFeatures: { path: ['agents', k], equals: true } })) },
    select: { id: true },
  })
  let drafted = 0
  let capped = 0
  for (const i of insts) {
    for (const r of [await runRapidResponseAgent(i.id, now), await runCareerServicesAgent(i.id, now)]) {
      drafted += r.drafted
      if (r.capped) capped++
    }
    for (const b of BRIEFS) {
      const r = await runBrief(i.id, b.agent, now)
      if (r.drafted) drafted++
      if (r.capped) capped++
    }
  }
  captureServerEvent('cron', 'staff_agents_daily_run', { orgs: insts.length, drafted, capped })
  return { enabled: true, orgs: insts.length, drafted, capped }
}
