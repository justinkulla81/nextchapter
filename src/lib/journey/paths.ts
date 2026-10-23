// Parallel paths: what a member is thinking about or doing next to their main focus. A member has ONE main
// journey (profile.journey: it alone sets the weekly plan's base, the menu and which emails go out) and any
// number of paths beside it. A path costs the plan nothing until it is active (researching or doing it, never
// merely curious) and then adds at most ONE step (parallelPlanItems). Pure and client-safe.
//
// Where things live (no schema change):
//   journeyDetails.paths.<key>.level   curious | researching | doing, for job, buy, start, fractional, side, school
//   journeyDetails.paths.side          hours, monthly income and goal for side work, beside its level
//   journeyDetails.paths.previousMain  the journey the member was on before the current one
//   journeyDetails.buy                 the Buy a business intake and stage (src/lib/journey/buy-business.ts)
//   journeyDetails.incomeNeed          how long they could go without new income (derived when we already know)
//   ParallelPath table                 which kinds of side work they do (contract, fractional, part-time, ...),
//                                      first asked on Past jobs and read by the job board and the coach brief
//
// Full-time fractional work stays a journey (FRACTIONAL). Fractional work as a side line is a path.
// Nothing here goes to anyone outside the product. Aggregates, when counted, are per path and level with a floor
// of ten members (./path-interest-counts.ts).

import type { JourneyType } from '@prisma/client'
import { buyDetailsOf, getBuyStage, hasBuyDetails, type BuyStageKey } from './buy-business'
import { getJourney } from './journey'

export type PathPlanItem = { text: string; actionType?: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const pathsOf = (details: unknown): Record<string, unknown> => {
  const p = (details as { paths?: unknown } | null)?.paths
  return isObj(p) ? p : {}
}

// ── What else are you thinking about? ────────────────────────────────────────

export const INTEREST_KEYS = ['job', 'buy', 'start', 'fractional', 'side', 'school'] as const
export type InterestKey = (typeof INTEREST_KEYS)[number]

export const INTEREST_LABELS: Record<InterestKey, string> = {
  job: 'A new job',
  buy: 'Buying a business',
  start: 'Starting a business',
  fractional: 'Fractional or consulting work',
  side: 'Side income or part-time work',
  school: 'Going back to school',
}

export const INTEREST_LEVELS = [
  { value: 'curious', label: 'Curious' },
  { value: 'researching', label: 'Researching' },
  { value: 'doing', label: 'Doing it' },
] as const
export type InterestLevel = (typeof INTEREST_LEVELS)[number]['value']
export const isInterestLevel = (v: unknown): v is InterestLevel => INTEREST_LEVELS.some((l) => l.value === v)

/** Researching or doing it: the only levels that put a step in the plan or a card on the page. */
export const isActiveLevel = (l: InterestLevel | undefined): boolean => l === 'researching' || l === 'doing'

export type InterestLevels = Partial<Record<InterestKey, InterestLevel>>

/** What the member said themselves, from journeyDetails.paths.<key>.level. */
export function statedLevelsOf(journeyDetails: unknown): InterestLevels {
  const p = pathsOf(journeyDetails)
  const out: InterestLevels = {}
  for (const k of INTEREST_KEYS) {
    const v = p[k]
    if (isObj(v) && isInterestLevel(v.level)) out[k] = v.level
  }
  return out
}

export type LevelSignals = {
  main: JourneyType | null
  journeyDetails: unknown
  /** The ParallelPath answer (kinds of side work). */
  kinds?: readonly string[] | null
  workingNow?: boolean
  /** profile.interimConsultingInterest */
  interimInterest?: boolean
}

const has = (kinds: readonly string[] | null | undefined, ...k: string[]) => (kinds ?? []).some((x) => k.includes(x))

/** What we already know without asking: from the main journey, a started buying plan, side-work answers and flags. */
export function derivedLevelsOf(s: LevelSignals): InterestLevels {
  const out: InterestLevels = {}
  if (s.main && getJourney(s.main).searching) out.job = 'doing'
  if (s.main === 'BUY_BUSINESS') out.buy = 'doing'
  else if (hasBuyDetails(s.journeyDetails)) {
    const stage = buyDetailsOf(s.journeyDetails).stage ?? 'decide'
    out.buy = stage === 'decide' || stage === 'prepare' ? 'researching' : 'doing'
  }
  if (s.main === 'ENTREPRENEUR' || has(s.kinds, 'OWN_BUSINESS')) out.start = 'doing'
  if (s.main === 'FRACTIONAL' || has(s.kinds, 'FRACTIONAL', 'CONSULTING')) out.fractional = 'doing'
  else if (s.interimInterest) out.fractional = 'researching'
  if (has(s.kinds, 'PART_TIME', 'CONTRACT_1099') || s.workingNow || hasSideDetails(s.journeyDetails)) out.side = 'doing'
  if (has(s.kinds, 'TRAINING')) out.school = 'doing'
  return out
}

/** The member's own answer wins over what we derived. */
export function effectiveLevelsOf(s: LevelSignals): InterestLevels {
  return { ...derivedLevelsOf(s), ...statedLevelsOf(s.journeyDetails) }
}

/** The interests still worth asking about: not the main journey's own path and not already known. */
export function askableInterests(s: LevelSignals): InterestKey[] {
  const known = derivedLevelsOf(s)
  const own: Partial<Record<JourneyType, InterestKey>> = { BUY_BUSINESS: 'buy', FRACTIONAL: 'fractional', ENTREPRENEUR: 'start' }
  const mainOwn = s.main ? own[s.main] : undefined
  return INTEREST_KEYS.filter((k) => !known[k] && k !== mainOwn)
}

/** A form's answers (one level or "none" per interest) made safe. Unknown keys and values are dropped. */
export function parseInterestInput(raw: Record<string, string | undefined>): Partial<Record<InterestKey, InterestLevel | 'none'>> {
  const out: Partial<Record<InterestKey, InterestLevel | 'none'>> = {}
  for (const k of INTEREST_KEYS) {
    const v = raw[`level_${k}`]
    if (v === 'none' || isInterestLevel(v)) out[k] = v
  }
  return out
}

/** The paths object to store: levels set or cleared, every other answer (side work, previous main) kept. */
export function mergeInterestLevels(journeyDetails: unknown, input: Partial<Record<InterestKey, InterestLevel | 'none'>>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...pathsOf(journeyDetails) }
  for (const k of INTEREST_KEYS) {
    const v = input[k]
    if (!v) continue
    const cur = isObj(next[k]) ? { ...(next[k] as Record<string, unknown>) } : {}
    if (v === 'none') delete cur.level
    else cur.level = v
    if (Object.keys(cur).length) next[k] = cur
    else delete next[k]
  }
  return next
}

// ── How long could you go without new income? ────────────────────────────────

export const INCOME_NEED_OPTIONS = [
  { value: 'year', label: 'A year or more' },
  { value: '6_12', label: '6 to 12 months' },
  { value: '3_6', label: '3 to 6 months' },
  { value: 'under_3', label: 'Under 3 months' },
] as const

export type IncomeNeed = (typeof INCOME_NEED_OPTIONS)[number]['value']

export function incomeNeedFromMonths(months: number): IncomeNeed {
  return months >= 12 ? 'year' : months >= 6 ? '6_12' : months >= 3 ? '3_6' : 'under_3'
}

const monthsIn = (details: unknown, key: string): number | null => {
  const v = (details as Record<string, unknown> | null)?.[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600 ? v : null
}

/** What we already know about how long they could go: a saved cushion, or an entrepreneur's runway. */
export function derivedIncomeNeed(details: unknown): IncomeNeed | null {
  const m = monthsIn(details, 'cushionMonths') ?? monthsIn(details, 'runwayMonths')
  return m === null ? null : incomeNeedFromMonths(m)
}

/** The member's answer if they gave one, otherwise what we can derive. */
export function incomeNeedOf(details: unknown): IncomeNeed | null {
  const v = (details as { incomeNeed?: unknown } | null)?.incomeNeed
  if (INCOME_NEED_OPTIONS.some((o) => o.value === v)) return v as IncomeNeed
  return derivedIncomeNeed(details)
}

/** True when we are using what we know and did not need to ask. */
export function incomeNeedIsDerived(details: unknown): boolean {
  const v = (details as { incomeNeed?: unknown } | null)?.incomeNeed
  return !INCOME_NEED_OPTIONS.some((o) => o.value === v) && derivedIncomeNeed(details) !== null
}

export type IncomeStrength = 'first' | 'steady' | 'option'

export type IncomeRecommendation = { strength: IncomeStrength; title: string; because: string; href: string; label: string }

// The kinds of side work in the ParallelPath answer (src/lib/job-reviews/constants.ts) that already bring in money.
const EARNING_KINDS = ['CONTRACT_1099', 'FRACTIONAL', 'CONSULTING', 'PART_TIME']

function alreadyEarning(kinds: readonly string[] | null | undefined, workingNow?: boolean): boolean {
  return !!workingNow || has(kinds, ...EARNING_KINDS)
}

/**
 * How income should shape the member's options. Under three months, income comes first; three to six adds one step a week;
 * six or more only shows interim and fractional work as an option. Not for full-time fractional members, nor for someone
 * already earning on the side. Early-career members never see interim or fractional steps (the plan drops them) and get
 * part-time and contract steps instead.
 */
export function incomeRecommendation(input: { need: IncomeNeed | null; main: JourneyType | null; kinds: readonly string[] | null | undefined; workingNow?: boolean }): IncomeRecommendation | null {
  const { need, main, kinds, workingNow } = input
  if (!need || main === 'FRACTIONAL' || alreadyEarning(kinds, workingNow)) return null
  const href = '/dashboard/interim-work'
  const label = 'Look at interim and fractional work'
  if (need === 'under_3')
    return {
      strength: 'first',
      title: 'Put income first',
      because: 'You said you could go under three months without new income. A full-time search usually takes longer, and a first fractional client takes weeks, so start with what pays soonest.',
      href,
      label,
    }
  if (need === '3_6')
    return {
      strength: 'steady',
      title: 'Add one income step every week',
      because: 'You said you could go three to six months. Starting the conversations now means paid work is ready before the money gets tight.',
      href,
      label,
    }
  return {
    strength: 'option',
    title: 'Interim or fractional work is an option',
    because: 'You have a long cushion, so there is no pressure. It is here if you want income sooner.',
    href,
    label,
  }
}

const T = (text: string, actionType?: string): PathPlanItem => ({ text, actionType })

const WEEK_MS = 7 * 86_400_000
const weekIndex = (now: Date) => Math.floor(now.getTime() / WEEK_MS)

/**
 * The income steps for this week's plan. Under three months: in order, unemployment and benefits (if laid off), then contract,
 * temp or part-time work, then interim or fractional work. Three to six: one step a week, alternating the quickest kind with the
 * longer one (a non-senior member always gets the quicker kind). Six or more: none; fractional shows as an option on the page.
 */
export function incomePlanItems(input: { details: unknown; main: JourneyType | null; kinds?: readonly string[] | null; workingNow?: boolean; now?: Date; senior?: boolean }): PathPlanItem[] {
  const rec = incomeRecommendation({ need: incomeNeedOf(input.details), main: input.main, kinds: input.kinds, workingNow: input.workingNow })
  if (!rec || rec.strength === 'option') return []
  const quick = T('Look for contract, temp or part-time work that pays within weeks, and tell three people what you can do', 'OUTREACH_MESSAGE')
  const interim = T('Start one conversation about interim or fractional work: a first client takes weeks, so begin now', 'OUTREACH_CALL')
  if (rec.strength === 'first') {
    const out: PathPlanItem[] = []
    if (input.main === 'LAID_OFF') out.push(T('Income comes first: confirm your unemployment benefits, what they pay and when your coverage ends'))
    out.push(quick, interim)
    return out
  }
  const senior = input.senior !== false
  return [senior && weekIndex(input.now ?? new Date()) % 2 === 1 ? interim : quick]
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

/** The side-work answers, read back safely from journeyDetails. */
export function sideDetailsOf(journeyDetails: unknown): SideDetails {
  const raw = pathsOf(journeyDetails).side
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

/** The paths object to store for side work: its answers merged in, its level and every other key kept. */
export function mergeSideDetails(journeyDetails: unknown, parsed: SideDetails): Record<string, unknown> {
  const paths = pathsOf(journeyDetails)
  const cur = isObj(paths.side) ? (paths.side as Record<string, unknown>) : {}
  return { ...paths, side: { ...cur, ...parsed } }
}

export function previousMainOf(journeyDetails: unknown): JourneyType | null {
  const v = pathsOf(journeyDetails).previousMain
  return typeof v === 'string' && /^[A-Z_]+$/.test(v) ? (v as JourneyType) : null
}

// ── The paths a member has ───────────────────────────────────────────────────

export type ParallelPathCard = {
  key: InterestKey
  label: string
  /** Where they stand, in a few words. */
  line: string
  /** Why this card is here. */
  because: string
  href: string
  level: InterestLevel
}

const LEVEL_LABEL: Record<InterestLevel, string> = { curious: 'Curious', researching: 'Researching', doing: 'Doing it' }

const PATH_HREF: Record<InterestKey, string> = {
  job: '/dashboard/find-my-job',
  buy: '/dashboard/buy-a-business',
  start: '/dashboard/other-paths',
  fractional: '/dashboard/interim-work',
  side: '/dashboard/other-paths',
  school: '/dashboard/learning',
}

// A path the main journey already is: never a card or a step beside itself.
function isMainsOwn(main: JourneyType | null, k: InterestKey): boolean {
  if (k === 'buy') return main === 'BUY_BUSINESS'
  if (k === 'fractional') return main === 'FRACTIONAL'
  if (k === 'start') return main === 'ENTREPRENEUR'
  if (k === 'job') return !!main && getJourney(main).searching
  return false
}

/** The active paths (researching or doing it) beside the main journey, one card each. Curious never shows. */
export function activePaths(s: LevelSignals): ParallelPathCard[] {
  const levels = effectiveLevelsOf(s)
  const out: ParallelPathCard[] = []
  for (const k of INTEREST_KEYS) {
    const level = levels[k]
    if (!level || !isActiveLevel(level) || isMainsOwn(s.main, k)) continue
    let line = LEVEL_LABEL[level]
    if (k === 'buy') line = `${LEVEL_LABEL[level]}: ${getBuyStage(buyDetailsOf(s.journeyDetails).stage ?? 'decide').label}`
    if (k === 'side') {
      const d = sideDetailsOf(s.journeyDetails)
      const bits = [d.hours ? `${d.hours} hours a week` : null, d.income ? `$${d.income.toLocaleString('en-US')} a month` : null].filter(Boolean)
      if (bits.length) line = `${LEVEL_LABEL[level]}: ${bits.join(', ')}`
    }
    out.push({ key: k, label: INTEREST_LABELS[k], line, because: `You said you are ${level === 'doing' ? 'doing this' : 'researching this'} next to your main focus.`, href: PATH_HREF[k], level })
  }
  return out
}

// ── Plan: at most one step per active path ───────────────────────────────────

function sideItem(side: SideDetails): PathPlanItem {
  if (side.goal === 'grow') return T('Pick the one client or customer who could make your side work bigger, and have a conversation with them', 'OUTREACH_CALL')
  if (side.goal === 'test') return T('Run one small test of your idea this week and write down what you learned')
  if (side.goal === 'cover') return T(side.hours ? `Spend your ${side.hours} side-work hours on the work that pays soonest, and ask one client about more` : 'Ask one current client about more work that pays soonest', 'OUTREACH_CALL')
  return T(side.hours ? `Keep your ${side.hours} side-work hours to a fixed time this week, so they do not crowd out your main plan` : 'Set a fixed time for your side work this week, so it does not crowd out your main plan')
}

function stepFor(k: InterestKey, level: InterestLevel, s: LevelSignals): PathPlanItem {
  switch (k) {
    case 'side':
      return sideItem(sideDetailsOf(s.journeyDetails))
    case 'buy': {
      const stage: BuyStageKey = buyDetailsOf(s.journeyDetails).stage ?? 'decide'
      return T(`Buying a business: ${getBuyStage(stage).next}`)
    }
    case 'job':
      return T('Look through this week’s strongest-fit roles and save one worth a second look')
    case 'start':
      return level === 'doing' ? T('Write down the one thing that must happen in your business this month') : T('Talk to one person who started a business in your field and ask what the first year cost', 'OUTREACH_CALL')
    case 'fractional':
      return level === 'doing' ? T('Ask one past client or colleague for an introduction to someone who could use your help', 'OUTREACH_CALL') : T('Write your one-line offer for fractional work: who you help and the result')
    case 'school':
      return level === 'doing' ? T('Spend one session on your course or program this week') : T('Look at one program you would consider and write down its cost, time and what it leads to')
  }
}

/** One step from each active path, never more: the main journey keeps the plan. Curious paths add nothing. */
export function parallelPlanItems(s: LevelSignals): PathPlanItem[] {
  return activePaths(s).map((c) => stepFor(c.key, c.level, s))
}

// ── Switching main focus ─────────────────────────────────────────────────────

/** The journeys a member can switch to from the paths page: the ones that a path can become. */
export const SWITCHABLE_MAIN: readonly JourneyType[] = ['BUY_BUSINESS', 'FRACTIONAL']

/** Returns the paths object to store when the journey changes: the old main journey is remembered so they can go back. */
export function rememberPreviousMain(existing: unknown, from: JourneyType | null, to: JourneyType | null): Record<string, unknown> | null {
  if (!from || !to || from === to) return null
  return { ...pathsOf(existing), previousMain: from }
}
