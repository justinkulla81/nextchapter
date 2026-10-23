// Parallel paths: what a member does alongside their main focus. A member has ONE main journey
// (profile.journey: it alone sets the weekly plan's base, the menu and which emails go out) and any
// number of paths next to it: buying a business, side or part-time work, fractional work as a side
// line. A path never changes the main journey's plan except by adding at most ONE step each, so the
// plan never balloons (see parallelPlanItems). Pure and client-safe.
//
// Where things live:
//   journeyDetails.buy            the Buy a business intake and stage (src/lib/journey/buy-business.ts)
//   journeyDetails.alongside.side hours, monthly income and goal for side work (below)
//   journeyDetails.alongside.previousMain  the journey the member was on before the current one
//   journeyDetails.incomeNeed     how soon they need income (every journey; asked once)
//   ParallelPath table            which kinds of side work they do (contract, fractional, part-time, ...),
//                                 first asked on Past jobs and read by the job board (src/lib/job-reviews)
//
// Full-time fractional work stays a journey (FRACTIONAL). Fractional work as a side line is one of the
// kinds in the ParallelPath answer.

import type { JourneyType } from '@prisma/client'
import { buyDetailsOf, getBuyStage, hasBuyDetails, type BuyStageKey } from './buy-business'

export type PathPlanItem = { text: string; actionType?: string }

// ── How soon do you need income? ─────────────────────────────────────────────

export const INCOME_NEED_OPTIONS = [
  { value: 'now', label: 'Within two months' },
  { value: 'soon', label: 'In three to six months' },
  { value: 'covered', label: 'I am covered for six months or more' },
] as const

export type IncomeNeed = (typeof INCOME_NEED_OPTIONS)[number]['value']

export function incomeNeedOf(details: unknown): IncomeNeed | null {
  const v = (details as { incomeNeed?: unknown } | null)?.incomeNeed
  return INCOME_NEED_OPTIONS.some((o) => o.value === v) ? (v as IncomeNeed) : null
}

export type IncomeRecommendation = { title: string; because: string; href: string; label: string }

// The kinds of side work in the ParallelPath answer (src/lib/job-reviews/constants.ts) that already bring in money.
const EARNING_KINDS = ['CONTRACT_1099', 'FRACTIONAL', 'CONSULTING', 'PART_TIME'] as const

/**
 * Whether to suggest interim or fractional work, and how strongly. Only when income matters soon, and only to someone
 * not already earning that way. Full-time fractional members already have it. Early-career members never see this
 * (the plan filters anything that says fractional or interim for them; see SENIOR_ONLY in ./plan.ts).
 */
export function incomeRecommendation(input: { need: IncomeNeed | null; main: JourneyType | null; kinds: readonly string[] | null | undefined; workingNow?: boolean }): IncomeRecommendation | null {
  const { need, main, kinds } = input
  if (!need || need === 'covered') return null
  if (main === 'FRACTIONAL') return null
  const earning = (kinds ?? []).some((k) => (EARNING_KINDS as readonly string[]).includes(k)) || !!input.workingNow
  if (earning) return null
  return need === 'now'
    ? {
        title: 'Interim or fractional work can bring income in weeks, not months',
        because: 'You said you need income within two months. A search for a full-time job usually takes longer, so line up paid work next to it.',
        href: '/dashboard/interim-work',
        label: 'Look at interim and fractional work',
      }
    : {
        title: 'Line up interim or fractional work before the money gets tight',
        because: 'You said you need income in three to six months. Starting the conversations early means paid work is ready when you need it.',
        href: '/dashboard/interim-work',
        label: 'Look at interim and fractional work',
      }
}

// ── Side work ────────────────────────────────────────────────────────────────

export const SIDE_GOALS = [
  { value: 'cover', label: 'Cover my bills while I search or build' },
  { value: 'extra', label: 'Extra money, no change of direction' },
  { value: 'grow', label: 'Grow it into my main work' },
  { value: 'test', label: 'Test an idea before I commit' },
] as const

export type SideGoal = (typeof SIDE_GOALS)[number]['value']

export type SideDetails = { hours?: number; income?: number; goal?: SideGoal }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** The side-work answers, read back safely from journeyDetails. */
export function sideDetailsOf(journeyDetails: unknown): SideDetails {
  const alongside = (journeyDetails as { alongside?: unknown } | null)?.alongside
  const raw = isObj(alongside) ? alongside.side : null
  if (!isObj(raw)) return {}
  const out: SideDetails = {}
  if (typeof raw.hours === 'number' && Number.isInteger(raw.hours) && raw.hours >= 1 && raw.hours <= 60) out.hours = raw.hours
  if (typeof raw.income === 'number' && Number.isInteger(raw.income) && raw.income >= 0 && raw.income <= 100_000) out.income = raw.income
  if (SIDE_GOALS.some((g) => g.value === raw.goal)) out.goal = raw.goal as SideGoal
  return out
}

export function hasSideDetails(journeyDetails: unknown): boolean {
  return Object.keys(sideDetailsOf(journeyDetails)).length > 0
}

/** A form's side-work values, made safe. Blank or invalid is dropped, so a skip never clears an earlier answer. */
export function parseSideInput(input: { hours?: string; income?: string; goal?: string }): SideDetails {
  const out: SideDetails = {}
  const whole = (s: string | undefined, min: number, max: number) => {
    const t = (s ?? '').replace(/[$,\s]/g, '')
    if (!t) return undefined
    const n = Number(t)
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined
  }
  const hours = whole(input.hours, 1, 60)
  const income = whole(input.income, 0, 100_000)
  if (hours !== undefined) out.hours = hours
  if (income !== undefined) out.income = income
  if (SIDE_GOALS.some((g) => g.value === input.goal)) out.goal = input.goal as SideGoal
  return out
}

/** Monthly side income in dollars, or 0. Feeds the runway estimate. */
export function sideIncomeOf(journeyDetails: unknown): number {
  return sideDetailsOf(journeyDetails).income ?? 0
}

export function previousMainOf(journeyDetails: unknown): JourneyType | null {
  const alongside = (journeyDetails as { alongside?: unknown } | null)?.alongside
  const v = isObj(alongside) ? alongside.previousMain : null
  return typeof v === 'string' && /^[A-Z_]+$/.test(v) ? (v as JourneyType) : null
}

// ── The paths a member has ───────────────────────────────────────────────────

export type PathKey = 'side' | 'buy'

export type ParallelPathCard = {
  key: PathKey
  label: string
  /** Where they stand, in a few words. */
  line: string
  /** Why this card is here. */
  because: string
  href: string
}

/**
 * The paths running next to the main journey. Buying shows when started and it is not already the main journey.
 * Side work shows when the member said they do any (the ParallelPath answer) or told us hours, income or a goal.
 */
export function activePaths(input: { main: JourneyType | null; journeyDetails: unknown; kinds: readonly string[] | null | undefined }): ParallelPathCard[] {
  const out: ParallelPathCard[] = []
  const side = sideDetailsOf(input.journeyDetails)
  const doingSide = (input.kinds ?? []).length > 0 || Object.keys(side).length > 0
  if (doingSide) {
    const bits = [side.hours ? `${side.hours} hours a week` : null, side.income ? `$${side.income.toLocaleString('en-US')} a month` : null].filter(Boolean)
    out.push({
      key: 'side',
      label: 'Side or part-time work',
      line: bits.length ? bits.join(', ') : 'Tell us the hours and what it earns',
      because: 'You said you do this next to your main focus.',
      href: '/dashboard/other-paths',
    })
  }
  if (input.main !== 'BUY_BUSINESS' && hasBuyDetails(input.journeyDetails)) {
    const stage = getBuyStage(buyDetailsOf(input.journeyDetails).stage ?? 'decide')
    out.push({ key: 'buy', label: 'Buying a business', line: stage.label, because: 'You started a buying plan next to your main focus.', href: '/dashboard/buy-a-business' })
  }
  return out
}

// ── Plan: at most one step per path ──────────────────────────────────────────

const T = (text: string, actionType?: string): PathPlanItem => ({ text, actionType })

function sideItem(side: SideDetails): PathPlanItem {
  if (side.goal === 'grow') return T('Pick the one client or customer who could make your side work bigger, and have a conversation with them', 'OUTREACH_CALL')
  if (side.goal === 'test') return T('Run one small test of your idea this week and write down what you learned')
  if (side.goal === 'cover') return T(side.hours ? `Spend your ${side.hours} side-work hours on the work that pays soonest, and ask one client about more` : 'Ask one current client about more work that pays soonest', 'OUTREACH_CALL')
  return T(side.hours ? `Keep your ${side.hours} side-work hours to a fixed time this week, so they do not crowd out your main plan` : 'Set a fixed time for your side work this week, so it does not crowd out your main plan')
}

/**
 * One step from each parallel path, never more: the member's main journey keeps the plan. Buying contributes its stage's
 * next step; side work one step shaped by its goal. Never called for the main journey's own path.
 */
export function parallelPlanItems(input: { main: JourneyType | null; journeyDetails: unknown; kinds?: readonly string[] | null }): PathPlanItem[] {
  const out: PathPlanItem[] = []
  const cards = activePaths({ main: input.main, journeyDetails: input.journeyDetails, kinds: input.kinds })
  for (const c of cards) {
    if (c.key === 'side') out.push(sideItem(sideDetailsOf(input.journeyDetails)))
    if (c.key === 'buy') {
      const stage: BuyStageKey = buyDetailsOf(input.journeyDetails).stage ?? 'decide'
      out.push(T(`Buying a business: ${getBuyStage(stage).next}`))
    }
  }
  return out
}

/** The income step for the plan: strongest when income is needed within two months. Null when none is called for. */
export function incomePlanItem(input: { details: unknown; main: JourneyType | null; kinds?: readonly string[] | null; workingNow?: boolean }): PathPlanItem | null {
  const rec = incomeRecommendation({ need: incomeNeedOf(input.details), main: input.main, kinds: input.kinds, workingNow: input.workingNow })
  if (!rec) return null
  const need = incomeNeedOf(input.details)
  return need === 'now'
    ? T('You need income within two months: have two conversations about interim or fractional work this week', 'OUTREACH_CALL')
    : T('Start one conversation about interim or fractional work, so paid work is ready before the money gets tight', 'OUTREACH_CALL')
}

// ── Switching main focus ─────────────────────────────────────────────────────

/** The journeys a member can switch to from the paths page: the ones that a path can become. */
export const SWITCHABLE_MAIN: readonly JourneyType[] = ['BUY_BUSINESS', 'FRACTIONAL']

/** Returns the details to store when the journey changes: the old main journey is remembered so they can go back. */
export function rememberPreviousMain(existing: unknown, from: JourneyType | null, to: JourneyType | null): Record<string, unknown> | null {
  if (!from || !to || from === to) return null
  const alongside = (existing as { alongside?: unknown } | null)?.alongside
  const base = isObj(alongside) ? alongside : {}
  return { ...base, previousMain: from }
}
