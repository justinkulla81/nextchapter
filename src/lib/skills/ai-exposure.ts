/**
 * Anthropic Economic Index "observed exposure" by occupation, and what it means for a person's search.
 * Pure, so the wording rules and the bands are tested without a database.
 *
 * What the score is: of the tasks an LLM could theoretically speed up in a job, how many already see AI use at work
 * (use that does the task counts in full, use that assists counts half, weighted by time spent on each task). It
 * measures use that is observed now. It is not a forecast of job loss, and 0 means no use observed yet, not "safe".
 * Source: Anthropic, "Labor market impacts of AI: a new measure", 5 March 2026, released under CC-BY, so every surface
 * that shows it credits the Anthropic Economic Index.
 */

export const AI_EXPOSURE_SOURCE = {
  name: 'Anthropic Economic Index',
  url: 'https://www.anthropic.com/research/labor-market-impacts',
  released: 'March 2026',
} as const

export type ExposureBand = 'high' | 'some' | 'little'

/**
 * Bands cut at the same places as the data: the top tenth of occupations score 0.28 or more, and more than half of
 * occupations show no observed use at all. 0.30 and above is the "high" band; below 0.10 is "little observed".
 */
export const HIGH_EXPOSURE_FROM = 0.3
export const SOME_EXPOSURE_FROM = 0.1

export const soc6Of = (socCode: string): string => socCode.slice(0, 7)

export function bandOf(score: number): ExposureBand {
  if (score >= HIGH_EXPOSURE_FROM) return 'high'
  if (score >= SOME_EXPOSURE_FROM) return 'some'
  return 'little'
}

export const BAND_LABEL: Record<ExposureBand, string> = {
  high: 'High',
  some: 'Some',
  little: 'Little observed',
}

export type ExposureMap = ReadonlyMap<string, { title: string; score: number }>

export interface OccupationExposure {
  soc6: string
  title: string
  score: number
  band: ExposureBand
}

/** The exposure for an O*NET-SOC (8 characters) or 6-digit SOC code, or null when the occupation is not in the data. */
export function exposureFor(socCode: string | null | undefined, map: ExposureMap): OccupationExposure | null {
  if (!socCode) return null
  const soc6 = soc6Of(socCode)
  const hit = map.get(soc6)
  return hit ? { soc6, title: hit.title, score: hit.score, band: bandOf(hit.score) } : null
}

/** The reason that goes under every score. One sentence: what it measures, and what it does not. */
export const EXPOSURE_WHY =
  'Share of this job’s tasks that AI is already used for at work, from real usage. It is not a forecast of job loss, and a low number means no use seen yet.'

/** A plain sentence about one occupation. Never "risk", "safe" or "will": the data says what is happening now. */
export function exposureSentence(e: OccupationExposure): string {
  switch (e.band) {
    case 'high':
      return `AI is already used for a large share of the tasks in ${e.title.toLowerCase()} work.`
    case 'some':
      return `AI is already used for some of the tasks in ${e.title.toLowerCase()} work.`
    default:
      return `AI use for ${e.title.toLowerCase()} work is little observed so far.`
  }
}

export interface JobsByExposure {
  /** Postings that carry an occupation we have a score for. */
  measured: number
  /** All postings considered. */
  total: number
  /** Share of all postings with a score, 0 to 1. Always shown next to the split so nobody reads it as the whole market. */
  coverage: number
  counts: Record<ExposureBand, number>
  /** Share of the measured postings in each band, 0 to 1. */
  shares: Record<ExposureBand, number>
}

/** Splits postings (counted per 6-digit SOC) into exposure bands. Postings without a score are left out of the shares. */
export function summarizeJobsByExposure(rows: ReadonlyArray<{ soc6: string | null; count: number }>, map: ExposureMap): JobsByExposure {
  const counts: Record<ExposureBand, number> = { high: 0, some: 0, little: 0 }
  let total = 0
  for (const r of rows) {
    total += r.count
    const hit = r.soc6 ? map.get(r.soc6) : undefined
    if (hit) counts[bandOf(hit.score)] += r.count
  }
  const measured = counts.high + counts.some + counts.little
  const share = (n: number) => (measured ? n / measured : 0)
  return {
    measured,
    total,
    coverage: total ? measured / total : 0,
    counts,
    shares: { high: share(counts.high), some: share(counts.some), little: share(counts.little) },
  }
}

export type RetrainingNeed = 'build_now' | 'build_alongside' | 'optional' | 'unknown'

/**
 * How much AI skill to build for a role, from the role's exposure alone. The jobs market adds to this elsewhere (what
 * postings ask for). `unknown` when the occupation is not measured: we say so rather than guess.
 */
export function retrainingNeed(e: OccupationExposure | null): RetrainingNeed {
  if (!e) return 'unknown'
  if (e.band === 'high') return 'build_now'
  if (e.band === 'some') return 'build_alongside'
  return 'optional'
}

export const RETRAINING_LINE: Record<RetrainingNeed, string> = {
  build_now: 'Build AI skills for this role first. The tasks are already changing.',
  build_alongside: 'Learn AI tools alongside your other skills. Part of the work is already changing.',
  optional: 'AI skills are optional for this role right now. Little use is seen so far.',
  unknown: 'We do not have an AI exposure measure for this occupation yet.',
}

/** "29%" for display next to the band. Always rounded to a whole percent; never shown without the band. */
export const scorePercent = (score: number): string => `${Math.round(score * 100)}%`
