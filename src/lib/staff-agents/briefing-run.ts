import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { FREE_AI_MODEL } from '@/lib/ai-tools/run'
import { donorReport } from '@/lib/higher-ed/fund'
import { hubDashboard } from '@/lib/workforce/hub'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { weekKey } from '@/lib/outplacement-agent/prompt'
import { captureServerEvent } from '@/lib/posthog/server'
import { reserveStaffAgentCall } from './reserve'
import { agentSwitchedOn, type StaffAgentKey } from './switch'
import { BRIEF_MAX_TOKENS, briefSystem, buildBriefUserMessage, parseBriefReply, small, type BriefAgent } from './briefing'

// One brief per organization per agent per week, saved in StaffAgentDraft (subjectId = the organization) and shown at the top of that
// workspace's home screen. The brief is counts only; the draft note in it is for staff to send themselves.

export const BRIEFS: { agent: BriefAgent; key: StaffAgentKey }[] = [
  { agent: 'alumni_services', key: 'alumniServices' },
  { agent: 'development', key: 'development' },
  { agent: 'workforce_dev', key: 'workforceDev' },
]

type Facts = Record<string, string | number>

async function factsFor(agent: BriefAgent, institutionId: string, now: Date): Promise<Facts | null> {
  if (agent === 'alumni_services') {
    const [newMatches, inTransition, placed] = await Promise.all([
      prisma.layoffMatch.count({ where: { institutionId, outreachStatus: 'NEW', isSampleData: false } }),
      prisma.transitionFlag.count({ where: { member: { institutionId }, state: 'IN_TRANSITION' } }),
      prisma.transitionFlag.count({ where: { member: { institutionId }, state: 'PLACED_GRACE' } }),
    ])
    if (!newMatches && !inTransition && !placed) return null
    return { alumni_matched_to_new_layoff_notices_not_yet_contacted: small(newMatches), alumni_in_transition: small(inTransition), alumni_recently_placed: small(placed) }
  }
  if (agent === 'development') {
    const [r, pendingGratitude] = await Promise.all([
      donorReport(institutionId),
      prisma.outcomeReport.count({ where: { gratitudeStatus: 'PENDING', member: { institutionId } } }),
    ])
    if (!r.fund) return null
    return {
      fund_goal_dollars: Math.round(r.fund.goalCents / 100),
      fund_raised_dollars: Math.round(r.fund.raisedCents / 100),
      seats_funded: small(r.awards),
      funded_alumni_who_landed_new_work: small(r.placed),
      gratitude_notes_waiting_for_approval: small(pendingGratitude),
    }
  }
  const [d, notices] = await Promise.all([hubDashboard(institutionId, now), regionNotices(institutionId, now)])
  if (!d.participants && !d.companies) return null
  return {
    participants: small(d.participants), joined_nextchapter: small(d.joined), active_this_week: small(d.activeThisWeek),
    searching: small(d.searching), landed_new_roles: small(d.landed), member_companies: small(d.companies),
    layoffs_with_seats_given: small(d.layoffs), recent_warn_filings_in_region: small(notices.filter((n) => n.inRegion).length),
  }
}

export interface BriefResult { institutionId: string; agent: BriefAgent; drafted: boolean; capped: boolean }

export async function runBrief(institutionId: string, agent: BriefAgent, now = new Date()): Promise<BriefResult> {
  const result: BriefResult = { institutionId, agent, drafted: false, capped: false }
  const key = BRIEFS.find((b) => b.agent === agent)!.key
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true, name: true, enabledFeatures: true, isSampleData: true } })
  if (!inst || inst.isSampleData || !agentSwitchedOn(inst.enabledFeatures, key)) return result
  const week = weekKey(now)
  if (await prisma.staffAgentDraft.findUnique({ where: { agent_subjectId_weekKey: { agent, subjectId: institutionId, weekKey: week } }, select: { id: true } })) return result
  const facts = await factsFor(agent, institutionId, now)
  if (!facts) return result

  const slot = await reserveStaffAgentCall(institutionId, agent)
  if (!slot.ok) { result.capped = true; return result }
  try {
    const user = buildBriefUserMessage(inst.name, facts)
    const message = await getAnthropicClient().messages.create({ model: FREE_AI_MODEL, max_tokens: BRIEF_MAX_TOKENS, system: briefSystem(agent), messages: [{ role: 'user', content: user }] })
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const brief = parseBriefReply(text, user)
    captureServerEvent(`staff-agent-${institutionId}`, 'staff_agent_brief_drafted', {
      institutionId, agent, week, usable: Boolean(brief), inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: FREE_AI_MODEL,
    })
    if (!brief) return result // tokens were spent, so the slot stays used
    try {
      await prisma.staffAgentDraft.create({
        data: { institutionId, agent, subjectId: institutionId, ownerId: '', weekKey: week, subject: brief.title, body: brief.body, reason: 'weekly brief', inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      })
      result.drafted = true
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  } catch (error) {
    console.error(`Staff brief ${agent} failed:`, error instanceof Error ? error.message : error)
    await slot.release?.()
  }
  return result
}

/** The latest brief for a workspace home screen, or null. Never throws: a missing table or failed read shows no brief. */
export async function latestBrief(institutionId: string, agent: BriefAgent): Promise<{ title: string; body: string } | null> {
  try {
    const row = await prisma.staffAgentDraft.findFirst({ where: { institutionId, agent, subjectId: institutionId }, orderBy: { createdAt: 'desc' }, select: { subject: true, body: true } })
    return row ? { title: row.subject, body: row.body } : null
  } catch (error) {
    console.error('Staff brief unavailable:', error instanceof Error ? error.message : error)
    return null
  }
}
