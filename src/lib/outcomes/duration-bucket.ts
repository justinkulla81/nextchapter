// Unemployment-duration buckets. Everything the outcomes release reports is
// compared WITHIN a bucket, never across them: people arrive at NextChapter at
// very different points in a search (adverse selection), and a long search
// itself lowers callbacks, so a single population-average time-to-offer would
// penalize us for taking the hardest cases. Bucket edges match the public CPS
// duration tables (<5, 5-14, 15-26, 27+ weeks) split further at 52 weeks.

export const DURATION_BUCKETS = ['W0_4', 'W5_13', 'W14_26', 'W27_52', 'W53_PLUS'] as const
export type DurationBucket = (typeof DURATION_BUCKETS)[number]

export const DURATION_BUCKET_LABEL: Record<DurationBucket, string> = {
  W0_4: '0-4 weeks',
  W5_13: '5-13 weeks',
  W14_26: '14-26 weeks',
  W27_52: '27-52 weeks',
  W53_PLUS: '53+ weeks',
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

// Whole weeks between the last day worked and `at`. Null when the date is
// missing or in the future (bad input), so callers never invent a duration.
export function weeksUnemployed(lastJobEndedAt: Date | null | undefined, at: Date): number | null {
  if (!lastJobEndedAt) return null
  const diff = at.getTime() - lastJobEndedAt.getTime()
  if (!Number.isFinite(diff) || diff < 0) return null
  return Math.floor(diff / MS_PER_WEEK)
}

export function durationBucketForWeeks(weeks: number | null | undefined): DurationBucket | null {
  if (weeks === null || weeks === undefined || !Number.isFinite(weeks) || weeks < 0) return null
  if (weeks <= 4) return 'W0_4'
  if (weeks <= 13) return 'W5_13'
  if (weeks <= 26) return 'W14_26'
  if (weeks <= 52) return 'W27_52'
  return 'W53_PLUS'
}
