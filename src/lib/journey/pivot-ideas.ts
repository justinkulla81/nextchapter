// Ideas for people who are thinking about a change and do not know where to start, or are
// nervous about it. Pure and client-safe. We show realistic options from what they already have:
// other functions close to theirs, industries where their function travels, and skills worth
// building, plus changes that are not a change of function at all. Thinking about it is not a
// commitment, and nothing here changes their search.

import { assessPivot, type PivotTier } from './feasibility'
import { FUNCTION_PROFILES, PIVOT_REASONS, assessReason, matchedSkills, type Alternative, type PivotReason } from './pathway'
import { assessIndustryMove, type IndustryTier } from './industry-feasibility'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'

export type FunctionIdea = { function: string; tier: PivotTier; headline: string; why: string; have: string[]; smallestStep: string }
export type IndustryIdea = { industry: string; tier: IndustryTier; why: string; smallestStep: string }
export type SkillIdea = { skill: string; forFunction: string }

export type IdeasInput = {
  from: string | null
  keywords: string[]
  ownedFunctions: string[]
  seniorLevel: boolean
  currentIndustry: string | null
  sectorHistory: string[]
  reason?: PivotReason | null
  // Already on their radar (including set aside), so we do not suggest it again.
  onRadar: string[]
  industriesOnRadar: string[]
  skillsToBuild: string[]
}

// Where each function tends to travel well, for ideas about industries.
const INDUSTRY_AFFINITY: Record<string, string[]> = {
  Finance: ['Financial Services & Banking', 'Insurance', 'Healthcare & Hospital Systems', 'Technology & Software', 'Construction & Real Estate'],
  Operations: ['Transportation & Logistics', 'Manufacturing & Industrial', 'Healthcare & Hospital Systems', 'Retail & E-commerce', 'Construction & Real Estate'],
  Marketing: ['Media & Entertainment', 'Advertising, Marketing & PR', 'Retail & E-commerce', 'Consumer Packaged Goods', 'Technology & Software'],
  Sales: ['Technology & Software', 'Staffing & Human Capital', 'Financial Services & Banking', 'Professional Services & Consulting', 'Telecommunications'],
  Engineering: ['Technology & Software', 'Aerospace & Defense', 'Automotive & Mobility', 'Energy & Utilities', 'Medical Devices'],
  Product: ['Technology & Software', 'Financial Services & Banking', 'Healthcare & Hospital Systems', 'Education & EdTech', 'Retail & E-commerce'],
  Design: ['Technology & Software', 'Media & Entertainment', 'Retail & E-commerce', 'Advertising, Marketing & PR', 'Education & EdTech'],
  'Human Resources': ['Staffing & Human Capital', 'Healthcare & Hospital Systems', 'Technology & Software', 'Education & EdTech', 'Nonprofit & Social Impact'],
  Administration: ['Healthcare & Hospital Systems', 'Education & EdTech', 'Professional Services & Consulting', 'Nonprofit & Social Impact', 'Government & Public Sector'],
  Legal: ['Professional Services & Consulting', 'Financial Services & Banking', 'Technology & Software', 'Healthcare & Hospital Systems', 'Government & Public Sector'],
  'Customer Success': ['Technology & Software', 'Telecommunications', 'Financial Services & Banking', 'Retail & E-commerce', 'Healthcare & Hospital Systems'],
  'Data & Analytics': ['Technology & Software', 'Financial Services & Banking', 'Healthcare & Hospital Systems', 'Retail & E-commerce', 'Insurance'],
}
const DEFAULT_AFFINITY = ['Technology & Software', 'Professional Services & Consulting', 'Healthcare & Hospital Systems', 'Education & EdTech', 'Nonprofit & Social Impact']

const TIER_SCORE: Record<PivotTier, number> = { SAME: -10, ADJACENT: 4, BRIDGE: 2, REBUILD: 0, LICENSED: -3, LEVEL_GATED: -10 }
const TIER_WORDS: Record<PivotTier, string> = {
  SAME: 'Your current field',
  ADJACENT: 'A natural move',
  BRIDGE: 'Possible with some learning',
  REBUILD: 'A bigger change',
  LICENSED: 'Needs a license',
  LEVEL_GATED: 'A level, not a field',
}

export function functionIdeas(input: IdeasInput, limit = 4): FunctionIdea[] {
  const ideas: { idea: FunctionIdea; score: number }[] = []
  for (const fn of Object.keys(FUNCTION_PROFILES)) {
    if (fn === input.from || input.onRadar.includes(fn)) continue
    const a = assessPivot(input.from, fn, { seniorLevel: input.seniorLevel, ownedFunctions: input.ownedFunctions })
    if (a.tier === 'LEVEL_GATED' || a.tier === 'SAME') continue
    const profile = FUNCTION_PROFILES[fn]
    const have = matchedSkills(profile.coreSkills, input.keywords)
    const owned = input.ownedFunctions.includes(fn)
    let score = TIER_SCORE[a.tier] + have.length * 0.7 + (owned ? 3 : 0)
    if (input.reason) {
      const r = assessReason(input.from, fn, input.reason, { seniorLevel: input.seniorLevel })
      if (r.alternatives.some((x) => x.label === fn)) score += 1.5
    }
    const why = owned
      ? `You told us you have already run ${fn} work.`
      : have.length > 0
        ? `You already have some of what ${fn} asks for: ${have.slice(0, 3).join(', ')}.`
        : a.tier === 'ADJACENT'
          ? `Your ${input.from ?? 'current'} experience carries over into ${fn}.`
          : `${fn} is a bigger change from ${input.from ?? 'where you are'}, and some people make it. It is fine to just look.`
    ideas.push({
      score,
      idea: {
        function: fn,
        tier: a.tier,
        headline: TIER_WORDS[a.tier],
        why,
        have,
        smallestStep: `Talk to one person who does ${fn} work and ask what a normal week looks like.`,
      },
    })
  }
  return ideas.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.idea)
}

export function industryIdeas(input: IdeasInput, limit = 4): IndustryIdea[] {
  const fn = input.from
  const pool = [...(fn && INDUSTRY_AFFINITY[fn] ? INDUSTRY_AFFINITY[fn] : DEFAULT_AFFINITY), ...DEFAULT_AFFINITY].filter((b) => INDUSTRY_BUCKET_NAMES.includes(b))
  const seen = new Set<string>()
  const out: { idea: IndustryIdea; score: number }[] = []
  for (const bucket of pool) {
    if (seen.has(bucket) || input.industriesOnRadar.includes(bucket)) continue
    seen.add(bucket)
    const m = assessIndustryMove(input.currentIndustry, bucket, fn, { sectorHistory: input.sectorHistory })
    if (m.tier === 'SAME') continue
    const score = { SAME: -5, EASY: 3, DOMAIN: 1.5, REGULATED: 0 }[m.tier] - seen.size * 0.05
    out.push({
      score,
      idea: {
        industry: bucket,
        tier: m.tier,
        why: m.tier === 'EASY' ? `${fn ?? 'Your function'} works much the same here, so this is a smaller move than it sounds.` : m.detail,
        smallestStep: m.learn[0] ?? `Ask two people in ${bucket} what is different from your world.`,
      },
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.idea)
}

// Skills worth building, taken from the fields that fit them best, so a skill always points to a reason.
export function skillIdeas(input: IdeasInput, fns: FunctionIdea[], limit = 5): SkillIdea[] {
  const have = new Set(input.skillsToBuild.map((s) => s.toLowerCase().replace(/_/g, ' ')))
  const out: SkillIdea[] = []
  for (const idea of fns) {
    const profile = FUNCTION_PROFILES[idea.function]
    for (const skill of profile.coreSkills.filter((s) => !idea.have.includes(s)).slice(0, 2)) {
      if (have.has(skill.toLowerCase()) || out.some((o) => o.skill === skill)) continue
      out.push({ skill, forFunction: idea.function })
    }
  }
  return out.slice(0, limit)
}

// Changes that are not a change of function: often what people are really after.
export function stayAndShiftIdeas(reason: PivotReason | null | undefined, from: string | null): Alternative[] {
  const base: Alternative[] = [
    { label: `${from ?? 'Your function'} in a different industry`, why: 'The same skills, a new setting. It is the easiest kind of change and often fixes what people are tired of.' },
    { label: `${from ?? 'Your function'} as fractional or consulting work`, why: 'More control over your time and your clients, with the experience you already have.' },
    { label: `${from ?? 'Your function'} at a different kind of company`, why: 'A smaller, larger or more mission-led company can feel like a different job.' },
  ]
  if (!reason) return base
  const tailored = assessReason(from, from ?? '', reason).alternatives.filter((a) => !a.tier)
  return [...tailored, ...base].slice(0, 3)
}

export function pivotIdeas(input: IdeasInput) {
  const functions = functionIdeas(input)
  return {
    functions,
    industries: industryIdeas(input),
    skills: skillIdeas(input, functions),
    stayAndShift: stayAndShiftIdeas(input.reason, input.from),
    reasonLabel: input.reason ? PIVOT_REASONS.find((r) => r.key === input.reason)?.label ?? null : null,
  }
}
