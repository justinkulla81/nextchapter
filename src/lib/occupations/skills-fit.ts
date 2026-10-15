import { memberHasSkill } from '@/lib/jobs/job-skill-gap'
import { elementKey, elementWeight, occupationSimilarity, type Vector } from './similarity'
import type { ElementKind, OccupationProfile } from './types'

// How well a member's background fits a target occupation. Two signals, both from
// public O*NET data and no AI at view time:
//   - transferability: how alike the member's current occupation is to the target on
//     skills, knowledge, abilities and work activities (similarity.ts)
//   - tools: how many of the target's named technologies the member's resume shows
// Where a signal can't be computed it is left out and the basis says so. A gap is
// claimed only against a known baseline: with no current occupation we say nothing
// about what the member lacks, rather than list everything the target needs.

export type FitBasis = 'occupation_and_tools' | 'occupation_only' | 'tools_only' | 'none'

export interface ToolsFit {
  requested: string[]
  have: string[]
  missing: string[]
  /** Share of the target's named tools the member shows, 0-100; null when the target lists too few to judge. */
  coveragePct: number | null
}

export interface ElementGap {
  kind: ElementKind
  name: string
  /** 0-1 weight in the target and in the member's current occupation. */
  targetWeight: number
  currentWeight: number
}

export interface SkillsFit {
  /** 0-100, or null when neither signal is available. */
  score: number | null
  /** 0-100 transferability, null without a current occupation. */
  transferability: number | null
  tools: ToolsFit
  gaps: ElementGap[]
  basis: FitBasis
}

export const TRANSFERABILITY_WEIGHT = 0.6
export const TOOLS_WEIGHT = 0.4
/** Fewer named tools than this is too little to judge a tools fit. */
export const MIN_TOOLS_FOR_FIT = 3
export const MAX_TOOLS = 10
/** An element only counts as something the target needs at or above this weight. */
export const GAP_MIN_TARGET_WEIGHT = 0.35
/** The member's occupation has to trail the target by at least this much for it to be a gap. */
export const GAP_MIN_DIFFERENCE = 0.15
export const MAX_GAPS = 6

/** The target's named tools, hot technologies first, capped. */
export function targetTools(target: Pick<OccupationProfile, 'techSkills'>): string[] {
  const seen = new Set<string>()
  const ordered = [...target.techSkills].sort((a, b) => Number(!!b.hotTechnology) - Number(!!a.hotTechnology))
  const out: string[] = []
  for (const t of ordered) {
    const key = t.example.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(t.example.trim())
    if (out.length >= MAX_TOOLS) break
  }
  return out
}

/**
 * Does the member show this tool? Tools of one or two characters ("R", "C#") match only
 * a keyword that is exactly that: whole-word matching would find "R" inside "R&D".
 */
export function memberShowsTool(tool: string, memberKeywords: string[]): boolean {
  const t = tool.trim().toLowerCase()
  if (t.length <= 2) return memberKeywords.some((k) => k.trim().toLowerCase() === t)
  return memberHasSkill(tool, memberKeywords)
}

export function toolsFit(memberKeywords: string[], target: Pick<OccupationProfile, 'techSkills'>): ToolsFit {
  const requested = targetTools(target)
  if (requested.length < MIN_TOOLS_FOR_FIT) return { requested: [], have: [], missing: [], coveragePct: null }
  const have = requested.filter((t) => memberShowsTool(t, memberKeywords))
  const missing = requested.filter((t) => !have.includes(t))
  return { requested, have, missing, coveragePct: Math.round((have.length / requested.length) * 100) }
}

function elementGaps(current: OccupationProfile, target: OccupationProfile): ElementGap[] {
  const cur = new Map(current.elements.map((e) => [elementKey(e), elementWeight(e)]))
  const gaps: ElementGap[] = []
  for (const e of target.elements) {
    const targetWeight = elementWeight(e)
    if (targetWeight < GAP_MIN_TARGET_WEIGHT) continue
    const currentWeight = cur.get(elementKey(e)) ?? 0
    if (targetWeight - currentWeight < GAP_MIN_DIFFERENCE) continue
    gaps.push({ kind: e.kind, name: e.name, targetWeight, currentWeight })
  }
  return gaps.sort((a, b) => b.targetWeight - b.currentWeight - (a.targetWeight - a.currentWeight)).slice(0, MAX_GAPS)
}

export function skillsFit(input: {
  /** The member's current occupation, from titleToOccupation on their latest title; null when it didn't map. */
  current: OccupationProfile | null
  /** resumeKeywords plus confirmedSkillsHave (memberSkillKeywords in src/lib/jobs/skill-gap-data.ts). */
  memberKeywords: string[]
  target: OccupationProfile
  /** buildCorpusMeans over the occupations in scope. */
  means: Vector
}): SkillsFit {
  const { current, memberKeywords, target, means } = input
  const transferability = current ? Math.round(occupationSimilarity(current, target, means) * 100) : null
  const tools = toolsFit(memberKeywords, target)
  const gaps = current ? elementGaps(current, target) : []

  const hasOcc = transferability !== null
  const hasTools = tools.coveragePct !== null
  let score: number | null = null
  let basis: FitBasis = 'none'
  if (hasOcc && hasTools) {
    score = Math.round(TRANSFERABILITY_WEIGHT * transferability + TOOLS_WEIGHT * tools.coveragePct!)
    basis = 'occupation_and_tools'
  } else if (hasOcc) {
    score = transferability
    basis = 'occupation_only'
  } else if (hasTools) {
    score = tools.coveragePct
    basis = 'tools_only'
  }
  return { score, transferability, tools, gaps, basis }
}
