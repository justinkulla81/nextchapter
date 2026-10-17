import { extractTopSkills } from '@/lib/companies/skills-extraction'
import { aiSkillGap, isAiAlias, type AiSkillGap } from '@/lib/skills/ai-skills'

// How a member's skills line up with what a job asks for. Pure — no database — so
// the rules are unit-tested (src/test/job-skill-gap.test.ts).
//
// A gap is claimed ONLY from the job's own description. Most board jobs carry none
// (about 7% do), and the tempting fallback — the skills an employer asks for across
// all its postings — is wrong for this purpose: it mixes engineering and sales and
// finance roles, so it told a sales executive they were missing "java". No
// description means no gap claimed, which is shown as nothing, not as a guess.
// No AI: a fixed skill vocabulary scanned against the text, so it costs nothing per view.

export type SkillGapBasis = 'posting' | 'none'

export interface JobSkillGap {
  basis: SkillGapBasis
  requested: string[]
  have: string[]
  missing: string[]
  /** Share of requested skills the member shows, 0-100; null when nothing was requested. */
  coveragePct: number | null
  /**
   * The AI skills the job asks for (ExclusiveJobPosting.aiSkillItems, read by the crawler from the
   * full text) against the member's skills. Also folded into requested / have / missing, first.
   */
  ai?: AiSkillGap
}

/** At most this many AI skills lead the requested list, so one AI-heavy posting can't crowd out the rest. */
export const MAX_AI_JOB_SKILLS = 3

export const MAX_JOB_SKILLS = 10
// Fewer than this many recognised skills in a description is too little to call a gap.
const MIN_POSTING_SKILLS = 2

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Does the member show this skill? Whole-word, never a loose substring: a keyword
 * "ad" must not match "advertising", and "r" must not match everything.
 */
export function memberHasSkill(skill: string, memberKeywords: string[]): boolean {
  const s = norm(skill)
  if (!s) return false
  const word = new RegExp(`(?:^|[^a-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'i')
  return memberKeywords.some((k) => {
    const kk = norm(k)
    if (kk.length < 2) return false
    return kk === s || word.test(kk) || new RegExp(`(?:^|[^a-z0-9])${kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'i').test(s)
  })
}

export function jobSkillGap(input: {
  title: string
  description: string | null
  /** Skills extracted from the full description at import (ExclusiveJobPosting.skills). Preferred: the stored description is only an excerpt. */
  skills?: string[]
  /** AI skill item ids the crawler read from the full posting (ExclusiveJobPosting.aiSkillItems). */
  aiSkillItems?: string[] | null
  memberKeywords: string[]
}): JobSkillGap {
  const jobAi = input.aiSkillItems ?? []
  const ai = aiSkillGap(jobAi, input.memberKeywords)
  const stored = (input.skills ?? []).slice(0, MAX_JOB_SKILLS)
  const scanned = stored.length === 0 && input.description ? extractTopSkills([`${input.title}\n${input.description}`], MAX_JOB_SKILLS).map((s) => s.term) : []
  // A posting skill that is one of its AI skills said another way ("machine learning") shows once, as the AI skill.
  const found = (stored.length > 0 ? stored : scanned).filter((t) => !isAiAlias(t, jobAi))
  // AI skills are explicit asks the crawler found, so they count even when the posting lists few other skills.
  const aiAsked = ai.asked.slice(0, MAX_AI_JOB_SKILLS)
  const basis: SkillGapBasis = found.length >= MIN_POSTING_SKILLS || aiAsked.length > 0 ? 'posting' : 'none'
  const posting = found.length >= MIN_POSTING_SKILLS ? found : []
  const requested = basis === 'posting' ? [...aiAsked, ...posting].slice(0, MAX_JOB_SKILLS) : []
  const have = requested.filter((t) => (aiAsked.includes(t) ? ai.have.includes(t) : memberHasSkill(t, input.memberKeywords)))
  const missing = requested.filter((t) => !have.includes(t))
  return {
    basis,
    requested,
    have,
    missing,
    coveragePct: requested.length > 0 ? Math.round((100 * have.length) / requested.length) : null,
    ai,
  }
}

// ── aggregate across a member's best-fit jobs (Market Reality, action plan) ──

export interface AggregatedSkillGap {
  jobsConsidered: number
  /** Jobs that had any skill data (posting or company basis). */
  jobsWithSkillData: number
  missing: { term: string; jobs: number }[]
  have: { term: string; jobs: number }[]
}

/**
 * Rolls per-job gaps into "what keeps coming up that you don't show". Each employer
 * counts once, so a chain's 46 near-identical store roles can't make one skill look
 * like the whole market.
 */
export function aggregateSkillGaps(
  jobs: { companyKey: string; gap: JobSkillGap }[],
  limit = 6
): AggregatedSkillGap {
  const missing = new Map<string, Set<string>>()
  const have = new Map<string, Set<string>>()
  const seenEmployers = new Set<string>()
  let withData = 0
  for (const { companyKey, gap } of jobs) {
    if (gap.basis === 'none') continue
    // One vote per employer per skill, but count the employer as "with data" once.
    if (!seenEmployers.has(companyKey)) {
      seenEmployers.add(companyKey)
      withData += 1
    }
    for (const t of gap.missing) (missing.get(t) ?? missing.set(t, new Set()).get(t)!).add(companyKey)
    for (const t of gap.have) (have.get(t) ?? have.set(t, new Set()).get(t)!).add(companyKey)
  }
  const rank = (m: Map<string, Set<string>>) =>
    [...m.entries()]
      .map(([term, set]) => ({ term, jobs: set.size }))
      .sort((a, b) => b.jobs - a.jobs || a.term.localeCompare(b.term))
      .slice(0, limit)
  return { jobsConsidered: jobs.length, jobsWithSkillData: withData, missing: rank(missing), have: rank(have) }
}
