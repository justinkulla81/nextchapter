'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { effectiveJourney } from '@/lib/journey/journey'
import { computeCompBandWithMarketFallback } from '@/lib/market-intelligence/comp-bands'
import { getCandidateMarketIntelTier, tierMeetsFeature } from '@/lib/market-intelligence/access'
import { memberMarketRole } from '@/lib/market/adzuna-insights'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SOURCES,
  MAX_LINE,
  MAX_TEXT,
  PREP_CHECKLIST,
  REVIEW_CADENCES,
} from '@/lib/in-work/constants'
import { validMonth } from '@/lib/in-work/review-schedule'
import { newId, parseActionItems, parseCheckItems, parseDateOnly } from '@/lib/in-work/types'
import { prepCompletion } from '@/lib/in-work/templates'
import { addFeedbackActionToSprint } from '@/lib/in-work/sprint-link'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const PATH = '/dashboard/in-work'
const SESSION_ENDED = { ok: false as const, error: 'Your session ended. Sign in again.' }
const CHECK_YOUR_INPUT = 'Check the fields and try again.'

async function requireMember() {
  const user = await getCurrentUser()
  if (!user) return null
  return prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      journey: true,
      journeyStage: true,
      currentJobStatus: true,
      targetFunction: true,
      primaryFunction: true,
      targetRoleType: true,
      currentState: true,
    },
  })
}

const dateString = z.string().refine((s) => parseDateOnly(s) !== null, 'Enter a valid date.')
const line = z.string().trim().min(1).max(MAX_LINE)
const text = z.string().trim().min(1).max(MAX_TEXT)
const optText = z.string().trim().max(MAX_TEXT).optional()

// ── Review settings ──────────────────────────────────────────────────────

const settingsSchema = z.object({
  cadence: z.enum(REVIEW_CADENCES.map((c) => c.key) as [string, ...string[]]),
  anchorMonth: z.number().int().min(1).max(12).nullable(),
  nextReviewDate: dateString.nullable(),
  promptsEnabled: z.boolean(),
})

export async function saveReviewSettings(input: z.infer<typeof settingsSchema>): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: CHECK_YOUR_INPUT }
  const { cadence, promptsEnabled } = parsed.data
  const nextReviewDate = parsed.data.nextReviewDate ? parseDateOnly(parsed.data.nextReviewDate) : null
  // A known date pins the month, so the half-year cycle follows it.
  let anchorMonth = parsed.data.anchorMonth
  if (!validMonth(anchorMonth) && nextReviewDate) anchorMonth = nextReviewDate.getUTCMonth() + 1
  if (validMonth(anchorMonth) && nextReviewDate && nextReviewDate.getUTCMonth() + 1 !== anchorMonth) {
    anchorMonth = nextReviewDate.getUTCMonth() + 1
  }

  await prisma.inWorkProfile.upsert({
    where: { candidateId: member.id },
    create: { candidateId: member.id, cadence, anchorMonth, nextReviewDate, promptsEnabled },
    update: { cadence, anchorMonth, nextReviewDate, promptsEnabled },
  })
  captureServerEvent(member.id, 'in_work_review_settings_saved', {
    cadence,
    anchorMonth,
    hasExactDate: !!nextReviewDate,
    promptsEnabled,
  })
  revalidatePath(PATH)
  return { ok: true }
}

// ── Impact log ───────────────────────────────────────────────────────────

const winSchema = z.object({
  what: text,
  result: text,
  whoBenefited: z.string().trim().max(MAX_LINE).optional(),
  occurredOn: dateString,
})

export async function addWin(input: z.infer<typeof winSchema>): Promise<ActionResult<{ id: string }>> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = winSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Add what you did and what changed.' }
  const occurredOn = parseDateOnly(parsed.data.occurredOn)!
  const win = await prisma.inWorkWin.create({
    data: {
      candidateId: member.id,
      what: parsed.data.what,
      result: parsed.data.result,
      whoBenefited: parsed.data.whoBenefited || null,
      occurredOn,
    },
  })
  const winCount = await prisma.inWorkWin.count({ where: { candidateId: member.id } })
  captureServerEvent(member.id, 'in_work_win_logged', {
    hasNumber: /\d/.test(parsed.data.result),
    hasBeneficiary: !!parsed.data.whoBenefited,
    winCount,
  })
  revalidatePath(PATH)
  return { ok: true, id: win.id }
}

export async function deleteWin(id: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  await prisma.inWorkWin.deleteMany({ where: { id, candidateId: member.id } })
  captureServerEvent(member.id, 'in_work_win_deleted', {})
  revalidatePath(PATH)
  return { ok: true }
}

// ── Review prep ──────────────────────────────────────────────────────────

const prepSchema = z.object({
  cycleKey: z.string().regex(/^\d{4}-\d{2}$/),
  checklist: z.record(z.string(), z.boolean()),
  wins: optText,
  goals: optText,
  theAsk: optText,
  evidence: optText,
  managerQuestions: z.array(z.string().trim().max(MAX_LINE)).max(5),
})

export async function savePrep(input: z.infer<typeof prepSchema>): Promise<ActionResult<{ complete: boolean }>> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = prepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: CHECK_YOUR_INPUT }
  const d = parsed.data

  const keys = PREP_CHECKLIST.map((c) => c.key)
  const checklist: Record<string, boolean> = {}
  for (const k of keys) checklist[k] = d.checklist[k] === true
  const completion = prepCompletion(checklist, keys)

  const existing = await prisma.inWorkPrep.findUnique({
    where: { candidateId_cycleKey: { candidateId: member.id, cycleKey: d.cycleKey } },
    select: { id: true, completedAt: true },
  })
  const completedAt = completion.complete ? (existing?.completedAt ?? new Date()) : null
  const data = {
    checklist,
    wins: d.wins ?? null,
    goals: d.goals ?? null,
    theAsk: d.theAsk ?? null,
    evidence: d.evidence ?? null,
    managerQuestions: d.managerQuestions.filter(Boolean),
    completedAt,
  }
  await prisma.inWorkPrep.upsert({
    where: { candidateId_cycleKey: { candidateId: member.id, cycleKey: d.cycleKey } },
    create: { candidateId: member.id, cycleKey: d.cycleKey, ...data },
    update: data,
  })
  if (!existing) captureServerEvent(member.id, 'in_work_prep_started', { cycleKey: d.cycleKey })
  if (completion.complete && !existing?.completedAt) {
    captureServerEvent(member.id, 'in_work_prep_completed', { cycleKey: d.cycleKey })
  }
  revalidatePath(PATH)
  return { ok: true, complete: completion.complete }
}

// ── Market range (the only lookup that can reach a market data provider) ──

export type MarketRangeResult = ActionResult<{
  available: boolean
  low: number | null
  high: number | null
  source: 'nc_job_board' | 'adzuna' | null
  sampleSize: number
  role: string | null
  place: string | null
  note: string
}>

// Runs only when the member asks. Reuses the Market Intelligence comp-band
// function and its tier gate, so the number here always matches that page.
export async function loadMarketRange(): Promise<MarketRangeResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const tier = await getCandidateMarketIntelTier(member.id)
  if (!tierMeetsFeature(tier, 'comp_bands')) {
    return {
      ok: true,
      available: false,
      low: null,
      high: null,
      source: null,
      sampleSize: 0,
      role: null,
      place: null,
      note: 'Market ranges are part of the Plus tier and above. You can still use the calculator with your own numbers.',
    }
  }
  const targetFunction = member.targetFunction ?? member.primaryFunction
  const band = await computeCompBandWithMarketFallback({
    targetFunction,
    role: memberMarketRole(member),
    state: member.currentState,
  })
  const usable = band.sufficientData && band.low !== null && band.high !== null
  captureServerEvent(member.id, 'in_work_negotiation_range_viewed', {
    available: usable,
    source: band.source,
    sampleSize: band.sampleSize,
    journey: effectiveJourney(member),
  })
  if (!usable) {
    return {
      ok: true,
      available: false,
      low: null,
      high: null,
      source: band.source,
      sampleSize: band.sampleSize,
      role: null,
      place: null,
      note:
        band.sampleSize > 0
          ? `We have only ${band.sampleSize} posted salary range${band.sampleSize === 1 ? '' : 's'} for your role. That is too few to show a range, so we do not show one.`
          : 'We have no posted salary data for your role yet, so we do not show a market range.',
    }
  }
  return {
    ok: true,
    available: true,
    low: band.low,
    high: band.high,
    source: band.source,
    sampleSize: band.sampleSize,
    role: band.adzunaRole ?? targetFunction ?? null,
    place: band.adzunaPlace ?? null,
    note:
      band.source === 'adzuna'
        ? 'Middle half of advertised salaries for your role.'
        : 'Median low and median high of posted salary ranges for your function on the NextChapter job board.',
  }
}

// ── Promotion plan ───────────────────────────────────────────────────────

const checkItemSchema = z.object({ id: z.string().max(40), text: line, done: z.boolean() })
const promotionSchema = z.object({
  targetLevel: z.string().trim().max(MAX_LINE).optional(),
  gapItems: z.array(checkItemSchema).max(20),
  stretchScope: optText,
  stretchDecider: z.string().trim().max(MAX_LINE).optional(),
  plan30: optText,
  plan60: optText,
  plan90: optText,
  visibilityItems: z.array(checkItemSchema).max(20),
})

export async function savePromotionPlan(input: z.infer<typeof promotionSchema>): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = promotionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: CHECK_YOUR_INPUT }
  const d = parsed.data
  const data = {
    targetLevel: d.targetLevel || null,
    gapItems: d.gapItems,
    stretchScope: d.stretchScope || null,
    stretchDecider: d.stretchDecider || null,
    plan30: d.plan30 || null,
    plan60: d.plan60 || null,
    plan90: d.plan90 || null,
    visibilityItems: d.visibilityItems,
  }
  await prisma.inWorkPromotionPlan.upsert({
    where: { candidateId: member.id },
    create: { candidateId: member.id, ...data },
    update: data,
  })
  captureServerEvent(member.id, 'in_work_promotion_plan_saved', {
    gapDone: d.gapItems.filter((g) => g.done).length,
    gapTotal: d.gapItems.length,
    hasStretchAsk: !!d.stretchScope,
    visibilityCount: d.visibilityItems.length,
  })
  revalidatePath(PATH)
  return { ok: true }
}

// ── Feedback ─────────────────────────────────────────────────────────────

const feedbackSchema = z.object({
  source: z.enum(FEEDBACK_SOURCES.map((s) => s.key) as [string, ...string[]]),
  category: z.enum(FEEDBACK_CATEGORIES.map((c) => c.key) as [string, ...string[]]),
  receivedOn: dateString,
  whatWasSaid: text,
  actionItems: z.array(line).max(10),
})

export async function addFeedback(input: z.infer<typeof feedbackSchema>): Promise<ActionResult<{ id: string }>> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Add who said it, when, and what they said.' }
  const d = parsed.data
  const row = await prisma.inWorkFeedback.create({
    data: {
      candidateId: member.id,
      source: d.source,
      category: d.category,
      receivedOn: parseDateOnly(d.receivedOn)!,
      whatWasSaid: d.whatWasSaid,
      actionItems: d.actionItems.map((t) => ({ id: newId(), text: t, done: false })),
    },
  })
  captureServerEvent(member.id, 'in_work_feedback_logged', {
    source: d.source,
    category: d.category,
    actionItemCount: d.actionItems.length,
  })
  revalidatePath(PATH)
  return { ok: true, id: row.id }
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  await prisma.inWorkFeedback.deleteMany({ where: { id, candidateId: member.id } })
  revalidatePath(PATH)
  return { ok: true }
}

export async function addFeedbackActionItem(feedbackId: string, itemText: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = line.safeParse(itemText)
  if (!parsed.success) return { ok: false, error: 'Write the action in one short line.' }
  const row = await prisma.inWorkFeedback.findFirst({ where: { id: feedbackId, candidateId: member.id } })
  if (!row) return { ok: false, error: 'That feedback entry no longer exists.' }
  const items = parseActionItems(row.actionItems)
  if (items.length >= 10) return { ok: false, error: 'Ten actions per entry is the limit. Finish one first.' }
  items.push({ id: newId(), text: parsed.data, done: false })
  await prisma.inWorkFeedback.update({ where: { id: row.id }, data: { actionItems: items } })
  revalidatePath(PATH)
  return { ok: true }
}

export async function toggleFeedbackActionItem(feedbackId: string, itemId: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const row = await prisma.inWorkFeedback.findFirst({ where: { id: feedbackId, candidateId: member.id } })
  if (!row) return { ok: false, error: 'That feedback entry no longer exists.' }
  const items = parseActionItems(row.actionItems).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
  await prisma.inWorkFeedback.update({ where: { id: row.id }, data: { actionItems: items } })
  revalidatePath(PATH)
  return { ok: true }
}

export async function sendFeedbackActionToSprint(
  feedbackId: string,
  itemId: string,
): Promise<ActionResult<{ added: boolean; message: string }>> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const row = await prisma.inWorkFeedback.findFirst({ where: { id: feedbackId, candidateId: member.id } })
  if (!row) return { ok: false, error: 'That feedback entry no longer exists.' }
  const items = parseActionItems(row.actionItems)
  const item = items.find((i) => i.id === itemId)
  if (!item) return { ok: false, error: 'That action no longer exists.' }
  const result = await addFeedbackActionToSprint(member.id, item.text)
  if (!result.added) {
    return {
      ok: true,
      added: false,
      message:
        result.reason === 'duplicate'
          ? 'That action is already in this week\'s plan.'
          : 'You have no weekly plan this week yet. Set your weekly goals first, then add this.',
    }
  }
  const updated = items.map((i) => (i.id === itemId ? { ...i, sprintAddedAt: new Date().toISOString() } : i))
  await prisma.inWorkFeedback.update({ where: { id: row.id }, data: { actionItems: updated } })
  captureServerEvent(member.id, 'in_work_feedback_action_sent_to_sprint', { category: row.category })
  revalidatePath(PATH)
  revalidatePath('/dashboard')
  return { ok: true, added: true, message: 'Added to this week\'s plan.' }
}

// ── Review outcome ───────────────────────────────────────────────────────

const outcomeSchema = z.object({
  cycleKey: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  reviewedOn: dateString,
  rating: z.string().trim().max(MAX_LINE).optional(),
  raiseReceived: z.boolean().nullable(),
  raisePercent: z.number().min(0).max(200).nullable(),
  promoted: z.boolean(),
  newTitle: z.string().trim().max(MAX_LINE).optional(),
  notes: optText,
  followUps: z.array(line).max(10),
})

export async function logOutcome(input: z.infer<typeof outcomeSchema>): Promise<ActionResult<{ id: string }>> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const parsed = outcomeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Add the date of the review at least.' }
  const d = parsed.data
  const row = await prisma.inWorkOutcome.create({
    data: {
      candidateId: member.id,
      cycleKey: d.cycleKey,
      reviewedOn: parseDateOnly(d.reviewedOn)!,
      rating: d.rating || null,
      raiseReceived: d.raiseReceived,
      raisePercent: d.raiseReceived ? d.raisePercent : null,
      promoted: d.promoted,
      newTitle: d.promoted ? d.newTitle || null : null,
      notes: d.notes || null,
      followUps: d.followUps.map((t) => ({ id: newId(), text: t, done: false })),
    },
  })
  captureServerEvent(member.id, 'in_work_outcome_logged', {
    cycleKey: d.cycleKey,
    raiseReceived: d.raiseReceived,
    promoted: d.promoted,
    followUpCount: d.followUps.length,
  })
  revalidatePath(PATH)
  return { ok: true, id: row.id }
}

export async function toggleOutcomeFollowUp(outcomeId: string, itemId: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  const row = await prisma.inWorkOutcome.findFirst({ where: { id: outcomeId, candidateId: member.id } })
  if (!row) return { ok: false, error: 'That entry no longer exists.' }
  const items = parseCheckItems(row.followUps).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
  await prisma.inWorkOutcome.update({ where: { id: row.id }, data: { followUps: items } })
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteOutcome(id: string): Promise<ActionResult> {
  const member = await requireMember()
  if (!member) return SESSION_ENDED
  await prisma.inWorkOutcome.deleteMany({ where: { id, candidateId: member.id } })
  revalidatePath(PATH)
  return { ok: true }
}
