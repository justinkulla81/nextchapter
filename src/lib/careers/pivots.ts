import type { OccupationProfile } from '@/lib/careers/types'
import { comparePay, type PayByLevel, type PayInfo, type PayLevel } from '@/lib/careers/local-pay'
import {
  ratedGaps,
  similarity,
  skillOverlap,
  toolGaps,
  type RatedGap,
  type ToolGap,
  type VectorSpace,
} from '@/lib/careers/vectors'

/** How much pay the person is willing to give up, as a share of their current occupation's median. */
export type WageFloor = 'ANY' | 'WITHIN_15' | 'MATCH'

export const WAGE_FLOOR_RATIO: Record<WageFloor, number> = { ANY: 0, WITHIN_15: 0.85, MATCH: 1 }
export const WAGE_FLOOR_LABEL: Record<WageFloor, string> = {
  ANY: 'Any pay',
  WITHIN_15: 'Within 15% of today',
  MATCH: 'Same or higher',
}
export const DEFAULT_WAGE_FLOOR: WageFloor = 'WITHIN_15'

export interface PivotOption {
  socCode: string
  title: string
  description?: string
  /** 0-1 centred skill similarity to the current occupation. Ranking key. */
  similarity: number
  /** 0-1 share of what this role asks for that the current role already covers. */
  overlap: number | null
  /** The pay figure to show, from the person's metro area if we have it, else their state, else the nation. */
  pay: PayInfo | null
  /** Median of `pay`, kept for callers that only want the number. */
  medianWage: number | null
  /** Percent difference from the current occupation at the same place (see payBasis). Null when there is no like-for-like pair. */
  wageDeltaPct: number | null
  /** The target's exact pay is withheld above BLS's ceiling, so wageDeltaPct is a floor ("at least"). */
  payAtLeast: boolean
  payBasis: PayLevel | null
  growthPct: number | null
  annualOpenings: number | null
  jobZone: number | null
  typicalEducation: string | null
  ratedGaps: RatedGap[]
  toolGaps: ToolGap[]
  /** O*NET also lists this occupation as related to the current one. */
  onetRelated: boolean
}

/** National pay from the median stored on the occupation itself, for when no per-area pay is loaded. */
export function nationalPayFromProfile(profile: OccupationProfile | undefined): PayByLevel {
  const wage = profile?.medianWage ?? null
  return wage
    ? { NATIONAL: { level: 'NATIONAL', areaName: 'United States', median: wage, p10: null, p25: null, p75: null, p90: null, employment: null, ceilingHit: false } }
    : {}
}

export interface RankPivotsInput {
  space: VectorSpace
  profiles: Map<string, OccupationProfile>
  sourceSoc: string
  wageFloor: WageFloor
  resumeKeywords: string[]
  limit?: number
  /** Pay by place for an occupation (see local-pay.ts). Defaults to the national median stored on the occupation. */
  pay?: (socCode: string) => PayByLevel
}

/**
 * Adjacent occupations for someone leaving `sourceSoc`, closest skills first.
 *
 * Candidates are the closest occupations by centred skill similarity plus the
 * ones O*NET lists as related. They are kept only if they sit at a comparable
 * preparation level (Job Zone no more than one below the current role, so a
 * director is not pointed at entry-level work) and clear the pay floor the
 * person chose. Where BLS has no wage for either side the pay filter does not
 * exclude it: unknown is shown as unknown, not treated as a pay cut.
 *
 * Ranking is by skill similarity alone. Pay, growth and local demand are shown
 * beside each option for the person to weigh, not blended into one opaque score.
 */
export function rankPivots(input: RankPivotsInput): PivotOption[] {
  const { space, profiles, sourceSoc, wageFloor, resumeKeywords } = input
  const limit = input.limit ?? 12
  const source = profiles.get(sourceSoc)
  if (!source) return []

  const payOf = input.pay ?? ((soc: string) => nationalPayFromProfile(profiles.get(soc)))
  const sourcePay = payOf(sourceSoc)
  const related = new Set(source.relatedSocCodes)
  const floor = WAGE_FLOOR_RATIO[wageFloor]
  const options: PivotOption[] = []

  for (const target of profiles.values()) {
    if (target.socCode === sourceSoc) continue
    const sim = similarity(space, sourceSoc, target.socCode)
    if (sim === null) continue
    const isRelated = related.has(target.socCode)
    // Weakly alike and not curated by O*NET: not a credible pivot.
    if (sim < 0.2 && !isRelated) continue

    if (source.jobZone !== null && target.jobZone !== null && target.jobZone < source.jobZone - 1) continue
    // Like-for-like pay: both occupations at the same place. A role whose exact pay is withheld
    // above BLS's ceiling is never excluded for pay, since its pay is at least the ceiling.
    const cmp = comparePay(sourcePay, payOf(target.socCode))
    if (floor > 0 && cmp.deltaPct !== null && !cmp.atLeast && 1 + cmp.deltaPct / 100 < floor) continue

    options.push({
      socCode: target.socCode,
      title: target.title,
      similarity: sim,
      overlap: skillOverlap(source, target),
      pay: cmp.pay,
      medianWage: cmp.pay?.median ?? null,
      wageDeltaPct: cmp.deltaPct,
      payAtLeast: cmp.atLeast,
      payBasis: cmp.basis,
      growthPct: target.growthPct,
      annualOpenings: target.annualOpenings,
      jobZone: target.jobZone,
      typicalEducation: target.typicalEducation,
      ratedGaps: ratedGaps(source, target, 4),
      toolGaps: toolGaps(source, target, resumeKeywords, 4),
      onetRelated: isRelated,
    })
  }

  return options
    .sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title))
    .slice(0, limit)
}
