// Net Promoter Score arithmetic and the rules for when to ask. Pure, so it is
// tested without a database (src/test/nps.test.ts).

export const NPS_QUESTION = 'How likely are you to recommend NextChapter to a friend or colleague?'
export const NPS_LOW_LABEL = 'Not at all likely'
export const NPS_HIGH_LABEL = 'Extremely likely'

/** Not in someone's first two weeks: they have not used enough to judge. */
export const NPS_MIN_ACCOUNT_AGE_DAYS = 14
/** After an answer, the next ask is a quarter later. */
export const NPS_ANSWERED_COOLDOWN_DAYS = 90
/** After "Not now", ask again in a month. */
export const NPS_DISMISSED_COOLDOWN_DAYS = 30

export const NPS_COMMENT_MAX = 2000

export type NpsCategory = 'promoter' | 'passive' | 'detractor'

export const isValidNpsScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10

/** 9-10 promoters, 7-8 passives, 0-6 detractors. */
export const npsCategory = (score: number): NpsCategory => (score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor')

export interface NpsSummary {
  responses: number
  promoters: number
  passives: number
  detractors: number
  /** Percent promoters minus percent detractors, -100 to 100, whole number. Null with no answers. */
  nps: number | null
}

export function summarizeNps(scores: readonly number[]): NpsSummary {
  const out: NpsSummary = { responses: scores.length, promoters: 0, passives: 0, detractors: 0, nps: null }
  for (const s of scores) out[`${npsCategory(s)}s` as 'promoters' | 'passives' | 'detractors']++
  if (scores.length > 0) out.nps = Math.round(((out.promoters - out.detractors) / scores.length) * 100)
  return out
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Whether to show the prompt now. `last` is the person's most recent
 * NpsResponse row, answered (score set) or dismissed (score null).
 */
export function isNpsDue(args: { now: Date; since: Date; last: { score: number | null; createdAt: Date } | null }): boolean {
  const { now, since, last } = args
  if (now.getTime() - since.getTime() < NPS_MIN_ACCOUNT_AGE_DAYS * DAY) return false
  if (!last) return true
  const wait = last.score === null ? NPS_DISMISSED_COOLDOWN_DAYS : NPS_ANSWERED_COOLDOWN_DAYS
  return now.getTime() - last.createdAt.getTime() >= wait * DAY
}
