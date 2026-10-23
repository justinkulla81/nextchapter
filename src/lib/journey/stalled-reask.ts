// The stalled-search re-ask. After a stretch of searching with no interviews, ask once what the member wants to change:
// broaden their targets, pivot to another field, add something next to the search, or talk to a coach. The weekly gates
// (src/lib/journey/engagement.ts) already add steps over time and the stalled-search card
// (src/lib/dashboard/stalled-search-prompt.ts) speaks to people who are hitting their goals; this is the one place that
// asks the whole question, and it asks only what we do not already know:
//   - a member who has told us the fields they are open to (journeyDetails.pivot) is pointed at those, not asked again;
//   - a member with a coach is pointed at that coach, not told to find one;
//   - a member with active paths is asked to adjust them, not to start one;
//   - an option they chose in the last six weeks is not offered again;
//   - interim and fractional work are named only to senior members (never early career).
// State lives in journeyDetails.reask (no schema change). Pure and client-safe: src/test/stalled-reask.test.ts.

import type { JourneyStage, JourneyType } from '@prisma/client'
import { getJourney } from './journey'
import { incomeNeedOf, type IncomeNeed } from './paths'

export type ReaskKey = 'broaden' | 'pivot' | 'paths' | 'coach'

export type ReaskOption = { key: ReaskKey; label: string; body: string; because: string; href: string }

/** Weeks of searching with no interview before the first ask. A casual search counts at half pace, like the weekly gates. */
export const REASK_AFTER_WEEKS = 6
/** Days before a member who answered (or was asked and said not now) is asked again. */
export const REASK_GAP_DAYS = 42
/** Days a "not now" waits. */
export const REASK_SNOOZE_DAYS = 28
/** Most times we ask one member. */
export const REASK_MAX_ASKS = 3
/** An option chosen within this many days is not offered again. */
export const REASK_OPTION_MEMORY_DAYS = 42
/** For this long after an answer the plan carries one matching step. */
export const REASK_PLAN_DAYS = 28

const DAY = 86_400_000
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export type ReaskState = {
  shownAt: string | null
  asks: number
  answeredAt: string | null
  answer: ReaskKey | null
  snoozeUntil: string | null
  stop: boolean
  /** When each option was last chosen, so it is not offered again straight away. */
  chosen: Partial<Record<ReaskKey, string>>
}

const KEYS: readonly ReaskKey[] = ['broaden', 'pivot', 'paths', 'coach']
export const isReaskKey = (v: unknown): v is ReaskKey => KEYS.includes(v as ReaskKey)

const iso = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : null)

/** What we have recorded about asking this member, read back safely from journeyDetails.reask. */
export function reaskStateOf(journeyDetails: unknown): ReaskState {
  const raw = (journeyDetails as { reask?: unknown } | null)?.reask
  const r = isObj(raw) ? raw : {}
  const chosen: ReaskState['chosen'] = {}
  if (isObj(r.chosen)) for (const k of KEYS) if (iso(r.chosen[k])) chosen[k] = iso(r.chosen[k])!
  return {
    shownAt: iso(r.shownAt),
    asks: typeof r.asks === 'number' && Number.isInteger(r.asks) && r.asks >= 0 && r.asks <= 50 ? r.asks : 0,
    answeredAt: iso(r.answeredAt),
    answer: isReaskKey(r.answer) ? r.answer : null,
    snoozeUntil: iso(r.snoozeUntil),
    stop: r.stop === true,
    chosen,
  }
}

export type ReaskContext = {
  journey: JourneyType | null
  stage: JourneyStage | null
  weeksInStage: number
  casual: boolean
  /** Interviews and offers since the member entered this stage (job postings), plus calendar interviews. */
  interviews: number
  offers: number
  journeyDetails: unknown
  hasCoach: boolean
  /** The member has told us the fields they are open to or committed to (journeyDetails.pivot). */
  pivotKnown: boolean
  /** How many paths beside the search are active (researching or doing it). */
  activePaths: number
  /** Doing interim, fractional, contract, consulting or part-time work already. */
  earning: boolean
  /** Senior enough to be shown interim and fractional work (never early career). */
  senior: boolean
  now?: Date
}

/** Whole weeks the search has run at its own pace: a casual search counts half. */
export function searchWeeks(weeksInStage: number, casual: boolean): number {
  return casual ? Math.floor(weeksInStage / 2) : weeksInStage
}

/** Whether to ask now. Null means do not. */
export function reaskDue(c: ReaskContext): { weeks: number; asks: number } | null {
  const j = c.journey ? getJourney(c.journey) : null
  // Only people looking for a job, in an active stage, with nothing to show for it.
  if (!j || !j.searching) return null
  if (c.stage !== 'APPLYING') return null
  if (c.interviews > 0 || c.offers > 0) return null
  const weeks = searchWeeks(c.weeksInStage, c.casual)
  if (weeks < REASK_AFTER_WEEKS) return null

  const s = reaskStateOf(c.journeyDetails)
  if (s.stop || s.asks >= REASK_MAX_ASKS) return null
  const now = (c.now ?? new Date()).getTime()
  if (s.snoozeUntil && new Date(s.snoozeUntil).getTime() > now) return null
  const last = [s.answeredAt, s.shownAt].filter((x): x is string => !!x).map((x) => new Date(x).getTime())
  if (last.length > 0 && now - Math.max(...last) < REASK_GAP_DAYS * DAY) return null
  return { weeks, asks: s.asks }
}

const earnsMoney = (need: IncomeNeed | null) => need === 'under_3' || need === '3_6'

/** The options to offer: only what is new to this member, the ones most relevant to them first. */
export function reaskOptions(c: ReaskContext): ReaskOption[] {
  const now = (c.now ?? new Date()).getTime()
  const s = reaskStateOf(c.journeyDetails)
  const need = incomeNeedOf(c.journeyDetails)
  const all: ReaskOption[] = [
    {
      key: 'broaden',
      label: 'Broaden my targets',
      body: 'Add a second role title, a nearby industry or a wider area.',
      because: 'Narrow targets are the most common reason a well-run search goes quiet.',
      href: '/dashboard/search-strategy',
    },
    c.pivotKnown
      ? {
          key: 'pivot',
          label: 'Look at the other fields I said I am open to',
          body: 'You already told us which fields interest you. See what it would take to test one.',
          because: 'Testing one field you already named is smaller than starting from scratch.',
          href: '/dashboard/pivot-paths',
        }
      : {
          key: 'pivot',
          label: 'Pivot to another field',
          body: 'See which fields your skills carry into, and what it would take.',
          because: 'Your skills may be worth more in a field with more openings.',
          href: '/dashboard/pivot-paths',
        },
    {
      key: 'paths',
      label: c.activePaths > 0 ? 'Change what I do next to my search' : 'Add something next to my search',
      body: c.senior ? 'Side work, interim or fractional work, buying a business, or school.' : 'Side work, school, or buying a business.',
      because: earnsMoney(need) && !c.earning ? 'You said you could go only a few months without income. Paid work next to the search covers the gap.' : 'A search with something else beside it is easier to keep up, and sometimes becomes the answer.',
      href: '/dashboard/other-paths',
    },
    c.hasCoach
      ? {
          key: 'coach',
          label: 'Book time with my coach',
          body: 'Bring this: weeks of searching and no interviews.',
          because: 'A stalled search usually needs one change. Your coach can find which.',
          href: '/dashboard/my-coaching',
        }
      : {
          key: 'coach',
          label: 'Talk to a coach',
          body: 'A coach reads what you are sending and where it stops.',
          because: 'A stalled search usually needs one change. A coach finds which.',
          href: '/dashboard/premium',
        },
  ]
  const recent = (k: ReaskKey) => {
    const at = s.chosen[k]
    return !!at && now - new Date(at).getTime() < REASK_OPTION_MEMORY_DAYS * DAY
  }
  let out = all.filter((o) => !recent(o.key))
  // Never leave fewer than two choices: if they have tried nearly everything, show everything.
  if (out.length < 2) out = all
  // Income first when the cushion is short and they are not earning.
  if (earnsMoney(need) && !c.earning) out = [...out.filter((o) => o.key === 'paths'), ...out.filter((o) => o.key !== 'paths')]
  return out
}

/** The state to store when the card is first shown. Starts the throttle. */
export function withShown(journeyDetails: unknown, now: Date): Record<string, unknown> {
  const s = reaskStateOf(journeyDetails)
  return { ...s, shownAt: now.toISOString(), asks: s.asks + 1 }
}

/** The state to store when they choose an option. */
export function withAnswer(journeyDetails: unknown, key: ReaskKey, now: Date): Record<string, unknown> {
  const s = reaskStateOf(journeyDetails)
  return { ...s, answeredAt: now.toISOString(), answer: key, snoozeUntil: null, chosen: { ...s.chosen, [key]: now.toISOString() } }
}

export function withSnooze(journeyDetails: unknown, now: Date): Record<string, unknown> {
  return { ...reaskStateOf(journeyDetails), snoozeUntil: new Date(now.getTime() + REASK_SNOOZE_DAYS * DAY).toISOString() }
}

export function withStop(journeyDetails: unknown): Record<string, unknown> {
  return { ...reaskStateOf(journeyDetails), stop: true }
}

// ── The plan follows the answer, for a few weeks ─────────────────────────────

const PLAN_STEP: Record<ReaskKey, { text: string; actionType?: string }> = {
  broaden: { text: 'Widen your targets: add a second role title or industry, and apply to three roles you would not have looked at' },
  pivot: { text: 'Pick one field you would test and have one conversation with someone in it', actionType: 'OUTREACH_CALL' },
  paths: { text: 'Take one step on the path you chose next to your search: ask one person about it this week', actionType: 'OUTREACH_CALL' },
  coach: { text: 'Book a coaching session and bring your last four weeks of applications' },
}

/** One step for four weeks after they answered: what they said they wanted to change. */
export function reaskPlanItems(journeyDetails: unknown, now: Date = new Date()): { text: string; actionType?: string }[] {
  const s = reaskStateOf(journeyDetails)
  if (!s.answer || !s.answeredAt) return []
  if (now.getTime() - new Date(s.answeredAt).getTime() > REASK_PLAN_DAYS * DAY) return []
  return [PLAN_STEP[s.answer]]
}
