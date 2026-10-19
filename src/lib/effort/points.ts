// Unlock points: how much real effort a member has put in since their last strategy, and whether
// that earns the next one (which also refreshes their report). Pure.
//
// This is deliberately a different, coarser scale from the Weekly Search Score (src/lib/weekly/
// action-effort.ts, where 1 point = 1 minute and an A is hundreds of points). Here a handful of
// whole points per activity, and the whole point is to answer one question: "has this member done
// enough new, real work that a fresh read of their search would say something new?"
//
// ── How each value was set ──────────────────────────────────────────────────
// Each activity is weighed on two things: how much it tells the strategy engine (signal), and what it
// costs the member (effort and friction). Points follow signal first, effort second.
//
//   Logged in            1  Signal is low (it shows they are engaged, not what they did) and costs
//                           almost nothing. It is here to build the habit, so it is worth a point
//                           but is capped hard and can never unlock on its own.
//   Applied to a job     2  Medium signal (volume and fit data) for 20 to 40 minutes. Applications
//                           the fit check already rates a poor match earn nothing: the probability
//                           engine already refuses to count them, and paying for spray would train it.
//   Networking touch     3  The highest-signal act in a senior search (it is weighted 4x an application
//                           in the probability engine) and the one members avoid most, so it pays most
//                           per unit of effort. A logged outreach, or a networking email sent.
//   Learning completed   2  Real effort (hours) but low signal for a strategy; it builds the skills
//                           gap this report names. Completions only, never "started".
//   Reference completed  2  A third party vouching is high signal, and the member's effort is a short
//                           ask. Counted when the reference is completed, not when requested.
//   Partner-search job   4  Showing interest in a partner-search job is the most valuable single click:
//                           it is a direct employer or search-firm role, shared with the partner, and
//                           the member is choosing it from a short list rather than a board of thousands.
//   Personalization      1  A new answer to a question we ask (src/lib/personalization/spine.ts).
//   answer                  Cheap, and each one sharpens every read after it. Only questions answered
//                           after onboarding count, and only ones answered since the cycle began.
//
// ── Guards against gaming ───────────────────────────────────────────────────
// Weekly caps stop one activity from carrying the whole bar, and the bar needs at least two kinds of
// real work besides logging in plus a minimum number of days, because a strategy built on two days of
// activity says nothing new.

export type EffortKind = 'login' | 'application' | 'networking' | 'learning' | 'reference' | 'partnerJob' | 'question'

export const POINT_VALUES: Record<EffortKind, number> = {
  login: 1,
  application: 2,
  networking: 3,
  learning: 2,
  reference: 2,
  partnerJob: 4,
  question: 1,
}

/** The most that counts in one calendar week (Monday to Sunday, UTC), or across a whole cycle where noted. */
export const CAPS: Record<EffortKind, { per: 'week' | 'cycle'; max: number }> = {
  login: { per: 'week', max: 5 }, // a day each; five days of habit is the goal, not seven
  application: { per: 'week', max: 5 },
  networking: { per: 'week', max: 4 },
  learning: { per: 'week', max: 2 },
  reference: { per: 'cycle', max: 3 },
  partnerJob: { per: 'week', max: 2 },
  question: { per: 'cycle', max: 8 },
}

export const KIND_LABEL: Record<EffortKind, { one: string; many: string; verb: string }> = {
  login: { one: 'day you logged in', many: 'days you logged in', verb: 'Log in' },
  application: { one: 'application', many: 'applications', verb: 'Apply to a well-matched role' },
  networking: { one: 'networking touch', many: 'networking touches', verb: 'Have or log a real conversation' },
  learning: { one: 'course completed', many: 'courses completed', verb: 'Complete a course' },
  reference: { one: 'reference completed', many: 'references completed', verb: 'Get a reference completed' },
  partnerJob: { one: 'partner-search job you showed interest in', many: 'partner-search jobs you showed interest in', verb: 'Show interest in a partner-search job' },
  question: { one: 'question answered', many: 'questions answered', verb: 'Answer a personalization question' },
}

export interface UnlockBar {
  points: number
  /** Days since the last unlock before the next can happen. */
  minDays: number
  /** Kinds of real work (not logging in) that must have earned something. */
  minKinds: number
}

/**
 * One bar for everyone: 30 points unlocks the next strategy and a refresh of the report together.
 * At least two kinds of real work besides logging in, and 14 days since the last, so the new read
 * rests on fresh evidence.
 */
export const UNLOCK_BAR: UnlockBar = { points: 30, minDays: 14, minKinds: 2 }

// ── Scoring ────────────────────────────────────────────────────────────────

const DAY = 86_400_000

/** UTC Monday 00:00 of the week a date falls in, as a number, to bucket by week. */
export function weekKey(d: Date): number {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  const dow = x.getUTCDay()
  x.setUTCDate(x.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return x.getTime()
}

export interface EffortActivity {
  /** Distinct UTC days they opened NextChapter. */
  loginDays: Date[]
  /** Applications that earn points (poor fits already removed). */
  applications: Date[]
  networking: Date[]
  learning: Date[]
  references: Date[]
  partnerJobs: Date[]
  /** New questions answered since the cycle began. */
  questionsAnswered: number
}

export interface KindScore {
  kind: EffortKind
  /** Everything the member did of this kind in the window. */
  done: number
  /** How many counted after the caps. */
  counted: number
  points: number
  /** How many more of this kind would still earn points this week (weekly caps), or this cycle. Null when uncapped. */
  roomLeft: number | null
}

export interface EffortScore {
  total: number
  byKind: KindScore[]
  /** Kinds of real work (not logging in) that earned something. */
  workKinds: number
}

function capByWeek(dates: Date[], max: number, now: Date): { counted: number; thisWeek: number } {
  const byWeek = new Map<number, number>()
  for (const d of dates) byWeek.set(weekKey(d), (byWeek.get(weekKey(d)) ?? 0) + 1)
  let counted = 0
  for (const n of byWeek.values()) counted += Math.min(n, max)
  return { counted, thisWeek: byWeek.get(weekKey(now)) ?? 0 }
}

export function scoreEffort(a: EffortActivity, now: Date = new Date()): EffortScore {
  const dated: [EffortKind, Date[]][] = [
    ['login', a.loginDays],
    ['application', a.applications],
    ['networking', a.networking],
    ['learning', a.learning],
    ['reference', a.references],
    ['partnerJob', a.partnerJobs],
  ]
  const byKind: KindScore[] = dated.map(([kind, dates]) => {
    const cap = CAPS[kind]
    let counted: number
    let roomLeft: number | null
    if (cap.per === 'week') {
      const r = capByWeek(dates, cap.max, now)
      counted = r.counted
      roomLeft = Math.max(0, cap.max - r.thisWeek)
    } else {
      counted = Math.min(dates.length, cap.max)
      roomLeft = Math.max(0, cap.max - counted)
    }
    return { kind, done: dates.length, counted, points: counted * POINT_VALUES[kind], roomLeft }
  })
  const q = Math.max(0, Math.round(a.questionsAnswered))
  const qCounted = Math.min(q, CAPS.question.max)
  byKind.push({ kind: 'question', done: q, counted: qCounted, points: qCounted * POINT_VALUES.question, roomLeft: Math.max(0, CAPS.question.max - qCounted) })
  const total = byKind.reduce((s, k) => s + k.points, 0)
  const workKinds = byKind.filter((k) => k.kind !== 'login' && k.points > 0).length
  return { total, byKind, workKinds }
}

// ── Unlocking ──────────────────────────────────────────────────────────────

export interface UnlockStatus {
  bar: UnlockBar
  score: EffortScore
  unlocked: boolean
  /** Points still to earn (0 when the points are there). */
  pointsShort: number
  /** Days until the minimum gap has passed (0 when it has). */
  daysLeft: number
  /** Kinds of work still needed beyond logging in (0 when enough). */
  kindsShort: number
  /** What still stands between the member and the unlock, in plain words. */
  blockers: string[]
  /** The highest-value things to do next, each with its points. */
  suggestions: { kind: EffortKind; verb: string; points: number }[]
}

export function unlockStatus(score: EffortScore, opts: { cycleStartedAt: Date; now?: Date }): UnlockStatus {
  const now = opts.now ?? new Date()
  const bar = UNLOCK_BAR
  const pointsShort = Math.max(0, bar.points - score.total)
  const daysLeft = Math.max(0, Math.ceil((opts.cycleStartedAt.getTime() + bar.minDays * DAY - now.getTime()) / DAY))
  const kindsShort = Math.max(0, bar.minKinds - score.workKinds)
  const unlocked = pointsShort === 0 && daysLeft === 0 && kindsShort === 0

  const blockers: string[] = []
  if (pointsShort > 0) blockers.push(`${pointsShort} more strategy credit${pointsShort === 1 ? '' : 's'}`)
  if (kindsShort > 0) blockers.push(`${kindsShort} more kind${kindsShort === 1 ? '' : 's'} of real work besides logging in`)
  if (daysLeft > 0) blockers.push(`${daysLeft} more day${daysLeft === 1 ? '' : 's'}, so the new read has fresh evidence to use`)

  // Suggest by points per unit, skipping what is capped out and what cannot be done on demand.
  const doable: EffortKind[] = ['partnerJob', 'networking', 'application', 'reference', 'learning', 'question']
  const suggestions = doable
    .map((k) => ({ kind: k, verb: KIND_LABEL[k].verb, points: POINT_VALUES[k], room: score.byKind.find((x) => x.kind === k)?.roomLeft ?? 1 }))
    .filter((s) => s.room > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(({ kind: k, verb, points }) => ({ kind: k, verb, points }))
  return { bar, score, unlocked, pointsShort, daysLeft, kindsShort, blockers, suggestions }
}
