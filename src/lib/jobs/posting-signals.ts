// Posting signals: who a posting says it welcomes, read by the crawler from the FULL posting text
// (nextchapter-jobs ncrawl/posting_signals.py, hand-checked at 93-100% precision) and stored in
// ExclusiveJobPosting.postingSignals. Pure and client-safe.
//
//   career_changer_welcome  "career changers welcome", non-traditional paths, transferable skills,
//                           returners after a career break, no degree required, bootcamp grads
//   ai_upskilled_welcome    self-taught AI / side projects count, AI courses or certificates count,
//                           "willing to learn AI", "no prior AI experience required"
//   high_eq                 emotional intelligence asked for as a trait of the hire
//
// What members see (docs/candidate-redesign.md): one quiet tag on a job, only when detected; one
// board filter ("Open to career changers / AI-upskilled", the `open` URL parameter); and, for members
// changing careers or early in their career, those jobs rank first within the same fit level.

//
// Entry-level signals (crawler ncrawl/entry_signals.py, 2026-10-23; rules and filters: entry-filters.ts) share
// the column: no_experience_ok (an entry / early-career job whose posting says people without experience are
// welcome; the phrase is in noExperiencePhrase) is the one that can show as a tag; entry_ai and
// entry_ai_preferred (an entry / early-career job asking for AI skills, the ask only preferred) never do.

export const POSTING_SIGNALS = ['career_changer_welcome', 'ai_upskilled_welcome', 'high_eq', 'no_experience_ok'] as const
export type PostingSignal = (typeof POSTING_SIGNALS)[number]
/** Stored with the others, never shown as a tag. */
export const ENTRY_ONLY_SIGNALS = ['entry_ai', 'entry_ai_preferred'] as const
const STORED = [...POSTING_SIGNALS, ...ENTRY_ONLY_SIGNALS] as const
export type StoredSignal = (typeof STORED)[number]

/** The import route's postingSignals, validated: known ids only, in canonical order. Left out when not sent. */
export function importPostingSignalFields(job: { postingSignals?: unknown }): { postingSignals?: StoredSignal[] } {
  if (!('postingSignals' in job) || job.postingSignals === undefined) return {}
  const sent = Array.isArray(job.postingSignals) ? new Set(job.postingSignals.filter((x): x is string => typeof x === 'string')) : new Set<string>()
  return { postingSignals: STORED.filter((s) => sent.has(s)) }
}

/** The tag text for each signal. */
export const POSTING_SIGNAL_TAG: Record<PostingSignal, string> = {
  career_changer_welcome: 'Open to career changers',
  ai_upskilled_welcome: 'Open to AI learners',
  high_eq: 'Values EQ',
  no_experience_ok: 'No experience needed',
}

/** Why the tag is there (the tag's title and the filter hint): every claim says why. */
export const POSTING_SIGNAL_WHY: Record<PostingSignal, string> = {
  career_changer_welcome: 'The posting says it welcomes career changers, transferable skills or non-traditional backgrounds.',
  ai_upskilled_welcome: 'The posting says self-taught AI skills, AI courses or a willingness to learn AI count.',
  high_eq: 'The posting asks for emotional intelligence: empathy, self-awareness, reading the room.',
  no_experience_ok: 'An entry-level job whose posting says people without experience are welcome.',
}

/** The signals the board filter keeps: either welcome. */
export const OPEN_FILTER_SIGNALS: readonly PostingSignal[] = ['career_changer_welcome', 'ai_upskilled_welcome']

/** The board filter's URL value (`open=changers`) and label. */
export const OPEN_FILTER_VALUE = 'changers'
export const OPEN_FILTER_LABEL = 'Open to career changers / AI-upskilled'
export const OPEN_FILTER_HINT = 'Only jobs whose posting says it welcomes career changers, transferable skills or people learning AI.'

/** The `open` URL parameter: on only for 'changers'. */
export function parseOpenParam(v: string | string[] | null | undefined): boolean {
  const s = Array.isArray(v) ? v[0] : v
  return s === OPEN_FILTER_VALUE
}

/** Does a job with these signals pass the "Open to career changers / AI-upskilled" filter? */
export function isOpenToChangers(signals: readonly string[] | null | undefined): boolean {
  return (signals ?? []).some((s) => (OPEN_FILTER_SIGNALS as readonly string[]).includes(s))
}

/**
 * Members whose jobs get the welcome lift: changing careers (the stored flag, a pivot target or the
 * Changing careers journey) or early in their career. Callers pass the already-derived facts.
 */
export function wantsChangerLift(m: { pivoting: boolean; earlyCareer: boolean }): boolean {
  return m.pivoting || m.earlyCareer
}

/**
 * The one tag a job shows, or null. One quiet tag at most: "No experience needed" first; then, for a
 * member the lift applies to, the welcome signals; otherwise career changers, then EQ, then AI learners.
 */
export function postingSignalTag(signals: readonly string[] | null | undefined, opts: { lift?: boolean } = {}): PostingSignal | null {
  const have = new Set(signals ?? [])
  // "No experience needed" first: it is the one entry-level tag cards show (entry-filters.ts).
  const order: PostingSignal[] = opts.lift
    ? ['no_experience_ok', 'career_changer_welcome', 'ai_upskilled_welcome', 'high_eq']
    : ['no_experience_ok', 'career_changer_welcome', 'high_eq', 'ai_upskilled_welcome']
  return order.find((s) => have.has(s)) ?? null
}

/**
 * Whether the tag takes the meta line's one quiet slot from the "Likely fewer applicants" hint. It
 * does for a welcome signal shown to a member the lift applies to; otherwise the hint keeps the slot
 * and the tag shows only on jobs without a hint. (What the tag removes: that hint, for those members.)
 */
export function tagTakesHintSlot(signal: PostingSignal, lift: boolean): boolean {
  // "No experience needed" always takes it (it removes the "Likely fewer applicants" hint on those jobs).
  if (signal === 'no_experience_ok') return true
  return lift && (OPEN_FILTER_SIGNALS as readonly string[]).includes(signal)
}
