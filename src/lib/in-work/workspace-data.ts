import 'server-only'
import { prisma } from '@/lib/prisma'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import type { CandidateProfile } from '@prisma/client'
import { isInWorkMember, isReviewCadence, type ReviewCadence } from './constants'
import { daysUntil, describeWindow, lastCycle, nextCycle, type ReviewCycle } from './review-schedule'
import { scheduleInputFrom } from './settings'
import {
  parseActionItems,
  parseCheckItems,
  parseChecklistMap,
  parseStringList,
  toDateOnly,
  type ActionItem,
  type CheckItem,
} from './types'
import { carryForwardFromOutcome } from './templates'

export type CycleView = {
  key: string
  label: string
  windowStart: string
  windowEnd: string
  prepareOn: string
  respondOn: string
  daysToWindow: number
  exact: boolean
}

export type WinView = { id: string; what: string; result: string; whoBenefited: string | null; occurredOn: string }
export type FeedbackView = {
  id: string
  source: string
  category: string
  receivedOn: string
  whatWasSaid: string
  actionItems: ActionItem[]
}
export type OutcomeView = {
  id: string
  cycleKey: string | null
  reviewedOn: string
  rating: string | null
  raiseReceived: boolean | null
  raisePercent: number | null
  promoted: boolean
  newTitle: string | null
  notes: string | null
  followUps: CheckItem[]
}

export type WorkspaceData = {
  inWorkJourney: boolean
  journeyLabel: string | null
  settings: {
    cadence: ReviewCadence
    anchorMonth: number | null
    nextReviewDate: string | null
    promptsEnabled: boolean
  }
  nextCycle: CycleView | null
  lastCycle: CycleView | null
  wins: WinView[]
  summarySince: string | null
  prep: {
    cycleKey: string
    checklist: Record<string, boolean>
    wins: string
    goals: string
    theAsk: string
    evidence: string
    managerQuestions: string[]
    completedAt: string | null
  } | null
  prepCycleKey: string | null
  carry: { recap: string | null; openFollowUps: string[]; lastGoals: string | null }
  plan: {
    targetLevel: string
    gapItems: CheckItem[]
    stretchScope: string
    stretchDecider: string
    plan30: string
    plan60: string
    plan90: string
    visibilityItems: CheckItem[]
  } | null
  feedback: FeedbackView[]
  outcomes: OutcomeView[]
}

function cycleView(c: ReviewCycle | null, now: Date): CycleView | null {
  if (!c) return null
  return {
    key: c.key,
    label: describeWindow(c),
    windowStart: toDateOnly(c.windowStart),
    windowEnd: toDateOnly(c.windowEnd),
    prepareOn: toDateOnly(c.prepareOn),
    respondOn: toDateOnly(c.respondOn),
    daysToWindow: daysUntil(c.windowStart, now),
    exact: c.exact,
  }
}

export async function loadWorkspace(profile: CandidateProfile): Promise<WorkspaceData> {
  const now = new Date()
  const id = profile.id
  const [row, wins, prepRows, plan, feedback, outcomes] = await Promise.all([
    prisma.inWorkProfile.findUnique({ where: { candidateId: id } }),
    prisma.inWorkWin.findMany({ where: { candidateId: id }, orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }], take: 300 }),
    prisma.inWorkPrep.findMany({ where: { candidateId: id }, orderBy: { cycleKey: 'desc' }, take: 3 }),
    prisma.inWorkPromotionPlan.findUnique({ where: { candidateId: id } }),
    prisma.inWorkFeedback.findMany({ where: { candidateId: id }, orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.inWorkOutcome.findMany({ where: { candidateId: id }, orderBy: [{ reviewedOn: 'desc' }, { createdAt: 'desc' }], take: 20 }),
  ])

  const schedule = scheduleInputFrom(row)
  const next = nextCycle(schedule, now)
  const last = lastCycle(schedule, now)
  const journey = effectiveJourney(profile)

  const currentPrep = next ? prepRows.find((p) => p.cycleKey === next.key) ?? null : null
  const priorPrep = prepRows.find((p) => !next || p.cycleKey !== next.key) ?? null
  const lastOutcome = outcomes[0] ?? null
  const carryBase = carryForwardFromOutcome(
    lastOutcome
      ? {
          reviewedOn: lastOutcome.reviewedOn,
          rating: lastOutcome.rating,
          raiseReceived: lastOutcome.raiseReceived,
          raisePercent: lastOutcome.raisePercent,
          promoted: lastOutcome.promoted,
          newTitle: lastOutcome.newTitle,
          followUps: parseCheckItems(lastOutcome.followUps),
        }
      : null,
  )

  return {
    inWorkJourney: isInWorkMember(profile),
    journeyLabel: journey ? getJourney(journey).label : null,
    settings: {
      cadence: row && isReviewCadence(row.cadence) ? row.cadence : 'HALF_YEARLY',
      anchorMonth: row?.anchorMonth ?? null,
      nextReviewDate: row?.nextReviewDate ? toDateOnly(row.nextReviewDate) : null,
      promptsEnabled: row?.promptsEnabled ?? true,
    },
    nextCycle: cycleView(next, now),
    lastCycle: cycleView(last, now),
    wins: wins.map((w) => ({
      id: w.id,
      what: w.what,
      result: w.result,
      whoBenefited: w.whoBenefited,
      occurredOn: toDateOnly(w.occurredOn),
    })),
    summarySince: lastOutcome ? toDateOnly(lastOutcome.reviewedOn) : null,
    prep: currentPrep
      ? {
          cycleKey: currentPrep.cycleKey,
          checklist: parseChecklistMap(currentPrep.checklist),
          wins: currentPrep.wins ?? '',
          goals: currentPrep.goals ?? '',
          theAsk: currentPrep.theAsk ?? '',
          evidence: currentPrep.evidence ?? '',
          managerQuestions: parseStringList(currentPrep.managerQuestions),
          completedAt: currentPrep.completedAt ? currentPrep.completedAt.toISOString() : null,
        }
      : null,
    prepCycleKey: next?.key ?? null,
    carry: { ...carryBase, lastGoals: priorPrep?.goals?.trim() || null },
    plan: plan
      ? {
          targetLevel: plan.targetLevel ?? '',
          gapItems: parseCheckItems(plan.gapItems),
          stretchScope: plan.stretchScope ?? '',
          stretchDecider: plan.stretchDecider ?? '',
          plan30: plan.plan30 ?? '',
          plan60: plan.plan60 ?? '',
          plan90: plan.plan90 ?? '',
          visibilityItems: parseCheckItems(plan.visibilityItems),
        }
      : null,
    feedback: feedback.map((f) => ({
      id: f.id,
      source: f.source,
      category: f.category,
      receivedOn: toDateOnly(f.receivedOn),
      whatWasSaid: f.whatWasSaid,
      actionItems: parseActionItems(f.actionItems),
    })),
    outcomes: outcomes.map((o) => ({
      id: o.id,
      cycleKey: o.cycleKey,
      reviewedOn: toDateOnly(o.reviewedOn),
      rating: o.rating,
      raiseReceived: o.raiseReceived,
      raisePercent: o.raisePercent,
      promoted: o.promoted,
      newTitle: o.newTitle,
      notes: o.notes,
      followUps: parseCheckItems(o.followUps),
    })),
  }
}
