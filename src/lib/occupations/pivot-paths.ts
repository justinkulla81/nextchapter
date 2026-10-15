import { skillsFit, type SkillsFit } from './skills-fit'
import type { Vector } from './similarity'
import type { OccupationOutlook, OccupationPay, OccupationProfile } from './types'

// Ranks the occupations a member could move toward by skills fit, with the pay and
// outlook BLS publishes for each. Rankings are fit, not a prediction that the move works.

export interface PayDifference {
  fromMedian: number
  toMedian: number
  /** Whole percent change from the current occupation's median pay. */
  changePct: number
}

export interface PivotPath {
  target: OccupationProfile
  fit: SkillsFit
  /** O*NET lists the target as related to the member's current occupation. */
  onetRelated: boolean
  /** Null when either median is missing or top-coded: executive pay is only a floor, so a difference would mislead. */
  pay: PayDifference | null
  outlook: OccupationOutlook | null
}

export const DEFAULT_PATH_LIMIT = 10
/** Targets that fit worse than this are not offered as a path. */
export const MIN_PATH_SCORE = 40

export function payDifference(from: OccupationPay | undefined, to: OccupationPay | undefined): PayDifference | null {
  if (!from || !to || from.topCoded || to.topCoded) return null
  if (!(from.medianWage && from.medianWage > 0) || !(to.medianWage && to.medianWage > 0)) return null
  return {
    fromMedian: from.medianWage,
    toMedian: to.medianWage,
    changePct: Math.round(((to.medianWage - from.medianWage) / from.medianWage) * 100),
  }
}

export function pivotPaths(input: {
  current: OccupationProfile
  candidates: OccupationProfile[]
  memberKeywords: string[]
  means: Vector
  pay?: Map<string, OccupationPay>
  outlook?: Map<string, OccupationOutlook>
  /** O*NET-SOC codes O*NET lists as related to `current`. */
  relatedOnetSocCodes?: Set<string>
  limit?: number
  minScore?: number
}): PivotPath[] {
  const { current, candidates, memberKeywords, means, pay, outlook, relatedOnetSocCodes } = input
  const minScore = input.minScore ?? MIN_PATH_SCORE
  const paths: PivotPath[] = []
  for (const target of candidates) {
    if (!target.isTarget || target.socCode === current.socCode) continue
    const fit = skillsFit({ current, memberKeywords, target, means })
    if (fit.score === null || fit.score < minScore) continue
    paths.push({
      target,
      fit,
      onetRelated: relatedOnetSocCodes?.has(target.onetSocCode) ?? false,
      pay: payDifference(pay?.get(current.socCode), pay?.get(target.socCode)),
      outlook: outlook?.get(target.socCode) ?? null,
    })
  }
  paths.sort(
    (a, b) =>
      (b.fit.score ?? 0) - (a.fit.score ?? 0) ||
      Number(b.onetRelated) - Number(a.onetRelated) ||
      a.target.title.localeCompare(b.target.title)
  )
  return paths.slice(0, input.limit ?? DEFAULT_PATH_LIMIT)
}
