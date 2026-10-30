import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { FREE_AI_MODEL } from '@/lib/ai-tools/run'
import { getWeeklyOutreachPlan } from '@/lib/network/weekly-outreach'
import { captureServerEvent } from '@/lib/posthog/server'
import { reserveAgentCall } from './reserve'
import { buildDraftUserMessage, DRAFT_MAX_TOKENS, DRAFT_SYSTEM, parseDraftReply, weekKey } from './prompt'
import { isOutplacementAgentOn } from './switch'

// The weekly run for one seat: the person's This week plan (people they already know, ordered by leverage) and a drafted note for
// each, stored so it is waiting on their This week page. Runs by itself (cron); no click needed. The person reviews and sends
// it themselves; nothing is sent, and nothing is written to their Google account.

export interface SeatRunResult { seatId: string; drafted: number; skipped: number; capped: boolean }

const first = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export async function runSeatWeek(seatId: string, now = new Date()): Promise<SeatRunResult> {
  const result: SeatRunResult = { seatId, drafted: 0, skipped: 0, capped: false }
  const seat = await prisma.outplacementSeat.findUnique({
    where: { id: seatId },
    select: { id: true, status: true, candidateId: true, accessEndsAt: true, contract: { select: { status: true, termEndAt: true } } },
  })
  if (!seat || seat.status !== 'ACTIVATED' || !seat.candidateId) return result
  if (seat.contract.status !== 'ACTIVE' || seat.contract.termEndAt < now) return result
  if (seat.accessEndsAt && seat.accessEndsAt < now) return result

  const candidateId = seat.candidateId
  const week = weekKey(now)
  const [profile, plan, existing] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { firstName: true, targetRoleType: true, confidentialSearchMode: true } }),
    getWeeklyOutreachPlan(candidateId),
    prisma.outplacementAgentDraft.findMany({ where: { seatId, weekKey: week }, select: { contactId: true } }),
  ])
  if (!profile) return result
  const done = new Set(existing.map((d) => d.contactId))
  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId, id: { in: plan.map((p) => p.contactId) } },
    select: { id: true, title: true },
  })
  const titleById = new Map(contacts.map((c) => [c.id, c.title]))

  for (const item of plan) {
    if (done.has(item.contactId)) { result.skipped++; continue }
    const slot = await reserveAgentCall(seatId, 'outreach_draft')
    if (!slot.ok) { result.capped = true; break }
    try {
      const facts = {
        candidateFirstName: profile.firstName ?? '',
        targetRole: profile.targetRoleType,
        discreet: profile.confidentialSearchMode,
        contactFirstName: first(item.name),
        contactCompany: item.company,
        contactTitle: titleById.get(item.contactId) ?? null,
        reason: item.reason,
        askSize: item.askSize,
        roleTitle: item.roleTitle ?? null,
      }
      const message = await getAnthropicClient().messages.create({
        model: FREE_AI_MODEL,
        max_tokens: DRAFT_MAX_TOKENS,
        system: DRAFT_SYSTEM,
        messages: [{ role: 'user', content: buildDraftUserMessage(facts) }],
      })
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      const draft = parseDraftReply(text, facts.contactFirstName)
      captureServerEvent(candidateId, 'outplacement_agent_draft_made', {
        seatId, contactId: item.contactId, purpose: item.purpose, week, usable: Boolean(draft),
        inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: FREE_AI_MODEL,
      })
      if (!draft) { result.skipped++; continue } // tokens were spent, so the slot stays used
      await prisma.outplacementAgentDraft.create({
        data: {
          seatId, candidateId, contactId: item.contactId, weekKey: week, subject: draft.subject, body: draft.body, reason: item.reason,
          inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens,
        },
      })
      result.drafted++
    } catch (error) {
      console.error('Outplacement agent draft failed:', error instanceof Error ? error.message : error)
      await slot.release?.()
      result.skipped++
    }
  }
  return result
}

/** Every activated seat on an active contract, one weekly run each. Does nothing while the switch is off. */
export async function runOutplacementAgentWeek(now = new Date()): Promise<{ enabled: boolean; seats: number; drafted: number; capped: number }> {
  if (!isOutplacementAgentOn()) return { enabled: false, seats: 0, drafted: 0, capped: 0 }
  const seats = await prisma.outplacementSeat.findMany({
    where: { status: 'ACTIVATED', candidateId: { not: null }, isSampleData: false, contract: { status: 'ACTIVE', termEndAt: { gte: now } } },
    select: { id: true },
  })
  let drafted = 0
  let capped = 0
  for (const s of seats) {
    const r = await runSeatWeek(s.id, now)
    drafted += r.drafted
    if (r.capped) capped++
  }
  captureServerEvent('cron', 'outplacement_agent_week_run', { seats: seats.length, drafted, capped })
  return { enabled: true, seats: seats.length, drafted, capped }
}

/** The drafts waiting for this week, for the member's This week page. Empty while the switch is off. */
export async function getSeatDraftsForWeek(candidateId: string, now = new Date()) {
  if (!isOutplacementAgentOn()) return []
  return prisma.outplacementAgentDraft.findMany({
    where: { candidateId, weekKey: weekKey(now) },
    select: { id: true, contactId: true, subject: true, body: true },
  })
}
