import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { FREE_AI_MODEL } from '@/lib/ai-tools/run'
import { getJourney, getStage, type JourneyStage, type JourneyType } from '@/lib/journey/journey'
import { weekKey } from '@/lib/outplacement-agent/prompt'
import { captureServerEvent } from '@/lib/posthog/server'
import { reserveStaffAgentCall } from './reserve'
import { agentSwitchedOn } from './switch'
import { buildCheckInUserMessage, CHECKIN_MAX_TOKENS, CHECKIN_SYSTEM, MAX_DRAFTS_PER_ORG_PER_RUN, needsCheckIn, parseCheckInReply, REDRAFT_AFTER_DAYS, type CaseloadFacts } from './career-services'

// The career-services agent: each week, for people on a counselor's caseload who share their search with Career Services and have gone
// quiet, it writes a short check-in note and saves it on the caseload screen under the person's name. The counselor reads it, edits it and
// sends it from their own email. Nothing is sent by us, nothing is written to anyone's Google account.

export const CAREER_AGENT = 'career_services'
const DAY = 86_400_000

export interface OrgRunResult { institutionId: string; drafted: number; skipped: number; capped: boolean }

type Row = CaseloadFacts & { assignmentId: string; journey: string | null; journeyStage: string | null }

export async function runCareerServicesAgent(institutionId: string, now = new Date()): Promise<OrgRunResult> {
  const result: OrgRunResult = { institutionId, drafted: 0, skipped: 0, capped: false }
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true, name: true, enabledFeatures: true, isSampleData: true } })
  if (!inst || inst.isSampleData || !agentSwitchedOn(inst.enabledFeatures, 'careerServices')) return result

  const rows = await prisma.$queryRaw<Row[]>`
    select v."assignmentId", v."counselorId", v."memberId", v."firstName", v."classYear", v."shareSearchDetail", v."lastActivityAt",
           v."sprintActionsTotal", v."sprintActionsDone", v.journey, v."journeyStage", a."assignedAt"
    from private.v_caseload_activity v
    join "CaseloadAssignment" a on a.id = v."assignmentId"
    where v."institutionId" = ${institutionId} and v."shareSearchDetail" = true and a."isSampleData" = false`
  const recent = await prisma.staffAgentDraft.findMany({
    where: { institutionId, agent: CAREER_AGENT, createdAt: { gte: new Date(now.getTime() - REDRAFT_AFTER_DAYS * DAY) } },
    select: { subjectId: true },
  })
  const recentlyDrafted = new Set(recent.map((d) => d.subjectId))
  const week = weekKey(now)

  const todo = rows
    .filter((r) => !recentlyDrafted.has(r.memberId))
    .map((r) => ({ r, why: needsCheckIn(r, now) }))
    .filter((x): x is { r: Row; why: string } => x.why !== null)
    .slice(0, MAX_DRAFTS_PER_ORG_PER_RUN)

  for (const { r, why } of todo) {
    const slot = await reserveStaffAgentCall(institutionId, CAREER_AGENT)
    if (!slot.ok) { result.capped = true; break }
    try {
      const situation = r.journey ? `${getJourney(r.journey as JourneyType).label}${r.journeyStage ? ` · ${getStage(r.journeyStage as JourneyStage).label}` : ''}` : null
      const message = await getAnthropicClient().messages.create({
        model: FREE_AI_MODEL,
        max_tokens: CHECKIN_MAX_TOKENS,
        system: CHECKIN_SYSTEM,
        messages: [{ role: 'user', content: buildCheckInUserMessage({ collegeName: inst.name, memberFirstName: r.firstName ?? '', classYear: r.classYear, situation }) }],
      })
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      const draft = parseCheckInReply(text, r.firstName ?? '')
      captureServerEvent(`staff-agent-${institutionId}`, 'staff_agent_career_checkin_drafted', {
        institutionId, memberId: r.memberId, counselorId: r.counselorId, usable: Boolean(draft),
        inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: FREE_AI_MODEL,
      })
      if (!draft) { result.skipped++; continue } // tokens were spent, so the slot stays used
      try {
        await prisma.staffAgentDraft.create({
          data: {
            institutionId, agent: CAREER_AGENT, subjectId: r.memberId, ownerId: r.counselorId, weekKey: week,
            subject: draft.subject, body: draft.body, reason: why, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
          },
        })
        result.drafted++
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
        result.skipped++ // already drafted this week by an earlier run
      }
    } catch (error) {
      console.error('Career services agent failed:', error instanceof Error ? error.message : error)
      await slot.release?.()
      result.skipped++
    }
  }
  return result
}

/** The latest draft per member for the caseload screen, with the member's email for a mailto link the counselor sends themselves. */
export async function careerDraftsFor(institutionId: string, memberIds: string[]) {
  if (!memberIds.length) return new Map<string, { subject: string; body: string; email: string | null }>()
  // The caseload screen must never break because of a draft: if the table is not there yet or the read fails, show no drafts.
  const [drafts, members] = await Promise.all([
    prisma.staffAgentDraft.findMany({
      where: { institutionId, agent: CAREER_AGENT, subjectId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
      select: { subjectId: true, subject: true, body: true },
    }),
    prisma.institutionMember.findMany({ where: { id: { in: memberIds }, institutionId }, select: { id: true, email: true } }),
  ]).catch((error) => {
    console.error('Career check-in drafts unavailable:', error instanceof Error ? error.message : error)
    return [[], []] as [{ subjectId: string; subject: string; body: string }[], { id: string; email: string | null }[]]
  })
  const email = new Map(members.map((m) => [m.id, m.email]))
  const out = new Map<string, { subject: string; body: string; email: string | null }>()
  for (const d of drafts) if (!out.has(d.subjectId)) out.set(d.subjectId, { subject: d.subject, body: d.body, email: email.get(d.subjectId) ?? null })
  return out
}
