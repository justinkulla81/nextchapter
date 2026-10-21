import type { OccupationProfile } from '@/lib/careers/types'
import { ratedGaps, skillOverlap, toolGaps } from '@/lib/careers/vectors'

/**
 * "Skills fit": how well a job's kind of work lines up with the person's, from O*NET, shown next to
 * the existing fit badge and never folded into it. The 100-point match heuristic stays as it is.
 *
 * It is a band, not a number, in keeping with the sitewide rule that candidates are not shown
 * precise-looking scores. It compares OCCUPATIONS (the job's title mapped to an O*NET occupation
 * against the person's current one), not the posting's text, so it cannot see seniority or the
 * specific stack a posting asks for; the separate skills-gap line reads the posting itself.
 */
export type SkillsFitBand = 'close' | 'good' | 'partial' | 'few'

export const SKILLS_FIT_LABEL: Record<SkillsFitBand, string> = {
  close: 'Lines up closely',
  good: 'Mostly lines up',
  partial: 'Partly lines up',
  few: 'Few skills in common',
}

export type SkillsFit =
  | {
      status: 'mapped'
      band: SkillsFitBand
      /** The O*NET occupation this job's title was matched to. */
      targetTitle: string
      /** Tools this kind of work uses that the person does not show, in-demand ones first. */
      toolsToLearn: string[]
      knowledgeToBuild: string[]
    }
  // title: we could not tell what kind of work the posting is. candidate: we do not know the person's current occupation.
  | { status: 'unmapped'; reason: 'title' | 'candidate' }

const BANDS: SkillsFitBand[] = ['few', 'partial', 'good', 'close']

export function bandFromOverlap(overlap: number): SkillsFitBand {
  if (overlap >= 0.9) return 'close'
  if (overlap >= 0.75) return 'good'
  if (overlap >= 0.55) return 'partial'
  return 'few'
}

const MIN_HOT_TOOLS_TO_JUDGE = 3
const HOT_TOOL_SHARE_FOR_BUMP = 0.6

/**
 * Share of the target's in-demand tools the person already evidences. Null when the target has too
 * few to judge from, since two or three tools say nothing about a role.
 */
function hotToolCoverage(target: OccupationProfile, have: ReadonlySet<string>): number | null {
  const hot = [...target.elements.entries()].filter(([, e]) => e.kind === 'TECHNOLOGY' && e.hotTech)
  if (hot.length < MIN_HOT_TOOLS_TO_JUDGE) return null
  return hot.filter(([id]) => have.has(id)).length / hot.length
}

export function computeSkillsFit(input: {
  source: OccupationProfile | null
  target: OccupationProfile | null
  haveKeywords: string[]
  haveSkillIds?: ReadonlySet<string>
}): SkillsFit {
  const { source, target } = input
  if (!target) return { status: 'unmapped', reason: 'title' }
  if (!source) return { status: 'unmapped', reason: 'candidate' }
  const have = input.haveSkillIds ?? new Set<string>()

  const overlap = source.socCode === target.socCode ? 1 : skillOverlap(source, target)
  if (overlap === null) return { status: 'unmapped', reason: 'title' }

  let band = bandFromOverlap(overlap)
  // Someone who already works with most of this role's in-demand tools is closer than their current
  // occupation alone suggests (an analyst who builds in the same stack): one band up, never past "close".
  const coverage = hotToolCoverage(target, have)
  if (coverage !== null && coverage >= HOT_TOOL_SHARE_FOR_BUMP) band = BANDS[Math.min(BANDS.indexOf(band) + 1, BANDS.length - 1)]

  return {
    status: 'mapped',
    band,
    targetTitle: target.title,
    toolsToLearn: toolGaps(source, target, input.haveKeywords, 3, have).map((t) => t.name),
    knowledgeToBuild: ratedGaps(source, target, 12)
      .filter((g) => g.kind === 'KNOWLEDGE')
      .slice(0, 2)
      .map((g) => g.name),
  }
}
