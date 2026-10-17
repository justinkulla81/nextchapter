// What a member's matching made of each job, and what changed between two runs of it — the
// numbers behind "Retuning your search" (before → after, with the top reasons). Pure: the
// verdicts come from match-compute.ts; tested in src/test/personalization.test.ts.
//
// A job is a match when it passes every relevance criterion (relevance.ts ring 0): inside the
// member's level window, within commuting distance (or remote), their own field, their skills,
// their industries (or a strong fit outside them), and not hidden by what they passed on. A
// strong fit is a match the fit scorer rates strong.

/** One bit per criterion a job fails. 0 = a match. */
export const FAIL = {
  level: 1,
  location: 2,
  field: 4,
  skills: 8,
  industry: 16,
  dismissed: 32,
} as const
export type Criterion = keyof typeof FAIL
/** Order reasons are told in, when a job fails more than one: the simplest to explain first. */
export const CRITERIA: Criterion[] = ['dismissed', 'location', 'level', 'field', 'industry', 'skills']
const FAIL_MASK = 63
/** Set on a match the fit scorer rates strong. */
export const STRONG = 64

export type Verdict = number
export const isMatch = (v: Verdict | undefined) => v !== undefined && (v & FAIL_MASK) === 0
export const isStrong = (v: Verdict | undefined) => isMatch(v) && (v! & STRONG) !== 0

/** A job's verdict from what failed. */
export function verdictOf(fails: Partial<Record<Criterion, boolean>>, strong = false): Verdict {
  let v = 0
  for (const c of CRITERIA) if (fails[c]) v |= FAIL[c]
  return v === 0 && strong ? STRONG : v
}

export interface MatchCounts {
  /** Jobs checked (the member's level window, less sectors they turned off). */
  checked: number
  matches: number
  strong: number
}

export function countVerdicts(verdicts: ReadonlyMap<string, Verdict>): MatchCounts {
  let matches = 0
  let strong = 0
  for (const v of verdicts.values()) {
    if (isMatch(v)) matches++
    if (isStrong(v)) strong++
  }
  return { checked: verdicts.size, matches, strong }
}

export interface RetuneReason {
  /** 'removed': matches before, not now; 'added': matches now, not before. */
  direction: 'removed' | 'added'
  criterion: Criterion
  count: number
}

/**
 * Per-job diff of two runs. A job that stopped matching is told by the first criterion (in
 * CRITERIA order) it fails now and passed before; a new match by the first it failed before.
 * A job missing from one run (outside that run's level window) fails 'level' there.
 */
export function diffVerdicts(before: ReadonlyMap<string, Verdict>, after: ReadonlyMap<string, Verdict>): RetuneReason[] {
  const tally = new Map<string, RetuneReason>()
  const bump = (direction: RetuneReason['direction'], criterion: Criterion) => {
    const key = `${direction}|${criterion}`
    const r = tally.get(key)
    if (r) r.count++
    else tally.set(key, { direction, criterion, count: 1 })
  }
  const ids = new Set([...before.keys(), ...after.keys()])
  for (const id of ids) {
    const b = before.get(id) ?? FAIL.level
    const a = after.get(id) ?? FAIL.level
    const was = isMatch(b)
    const now = isMatch(a)
    if (was === now) continue
    const [from, to] = was ? [b, a] : [a, b] // to: the run where it fails
    const flipped = CRITERIA.find((c) => (to & FAIL[c]) !== 0 && (from & FAIL[c]) === 0) ?? CRITERIA.find((c) => (to & FAIL[c]) !== 0)!
    bump(was ? 'removed' : 'added', flipped)
  }
  return [...tally.values()].sort((x, y) => y.count - x.count)
}

/** What the member's profile says, for reason lines ("too far from Sunnyvale"). */
export interface ReasonContext {
  city: string | null
  commuteMiles: number
  fieldLabel: string | null
  industries: string[]
  /** Tools they just added that the new matches ask for, most common first. */
  newTools: string[]
}

/** "312 removed — too far from Sunnyvale" / "22 new — match your Workday experience". */
export function reasonLine(r: RetuneReason, ctx: ReasonContext): string {
  const n = r.count.toLocaleString()
  if (r.direction === 'removed') {
    switch (r.criterion) {
      case 'location':
        return ctx.city ? `${n} removed — too far from ${ctx.city}` : `${n} removed — outside where you'd work`
      case 'level':
        return `${n} removed — outside your level`
      case 'field':
        return `${n} removed — not your kind of work${ctx.fieldLabel ? ` (${ctx.fieldLabel})` : ''}`
      case 'industry':
        return `${n} removed — outside ${ctx.industries.length > 0 ? ctx.industries.slice(0, 2).join(' and ') : 'your industries'}`
      case 'skills':
        return `${n} removed — ask for skills and tools you don't list`
      case 'dismissed':
        return `${n} hidden — like jobs you passed on`
    }
  }
  switch (r.criterion) {
    case 'location':
      return ctx.city ? `${n} new — within ${ctx.commuteMiles} mi of ${ctx.city}` : `${n} new — remote or where you'd move`
    case 'level':
      return `${n} new — at your level`
    case 'field':
      return `${n} new — your kind of work${ctx.fieldLabel ? ` (${ctx.fieldLabel})` : ''}`
    case 'industry':
      return `${n} new — in ${ctx.industries.length > 0 ? ctx.industries.slice(0, 2).join(' and ') : 'any industry'}`
    case 'skills':
      return ctx.newTools.length > 0 ? `${n} new — match your ${ctx.newTools.slice(0, 2).join(' and ')} experience` : `${n} new — match your skills and tools`
    case 'dismissed':
      return `${n} back — you undid a pass`
  }
}

export const RETUNE_TRIGGERS = ['city', 'tools', 'clearance', 'industry', 'search_strategy', 'resume', 'dismiss'] as const
export type RetuneTrigger = (typeof RETUNE_TRIGGERS)[number]
export function parseRetuneTrigger(v: unknown): RetuneTrigger | null {
  return typeof v === 'string' && (RETUNE_TRIGGERS as readonly string[]).includes(v) ? (v as RetuneTrigger) : null
}

export interface RetuneResult {
  trigger: RetuneTrigger
  /** null: no earlier inputs on file (first time), so only the "after" is shown. */
  before: { matches: number; strong: number } | null
  after: { matches: number; strong: number }
  checked: number
  /** At most three, biggest first, already worded. */
  reasons: string[]
  /** Signals read ("Reading your profile"), for the finished step list. */
  signals: number
  ms: number
  /** Extra plain lines the trigger earns (clearance: cleared jobs in the matches). */
  notes: string[]
}

/** The top reasons, worded; nothing when the matches didn't move. */
export function topReasons(reasons: RetuneReason[], ctx: ReasonContext, max = 3): string[] {
  return reasons.slice(0, max).map((r) => reasonLine(r, ctx))
}

/**
 * With no earlier run to compare: the jobs left out by a single criterion, biggest first
 * ("312 left out — too far from Sunnyvale"), as removals. Jobs failing several are not told.
 */
export function singleExclusions(verdicts: ReadonlyMap<string, Verdict>): RetuneReason[] {
  const tally = new Map<Criterion, number>()
  for (const v of verdicts.values()) {
    const f = v & FAIL_MASK
    if (f === 0 || (f & (f - 1)) !== 0) continue
    const c = CRITERIA.find((k) => FAIL[k] === f)!
    tally.set(c, (tally.get(c) ?? 0) + 1)
  }
  return [...tally].map(([criterion, count]) => ({ direction: 'removed' as const, criterion, count })).sort((a, b) => b.count - a.count)
}
