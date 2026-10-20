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

// ── by skill, AI and other apart (the Learning page's skills section) ──

/** A skill row needs this many employers asking, when enough rows do. */
const MIN_EMPLOYERS_FOR_ROW = 2

export interface SkillGapRow {
  term: string
  /** Employers (best-fit jobs, one vote each) whose jobs ask for it. */
  employers: number
  /** The member shows it. */
  have: boolean
  /** One of the 24 AI skill items (ai-skills.ts). */
  ai: boolean
}

export interface SkillGapByKind {
  jobsConsidered: number
  /** Employers with any skill data. */
  employersWithSkillData: number
  /** Employers with at least one job that asks for a specific AI skill. */
  employersAskingAi: number
  /** Gaps first, then skills they show; per kind (AI / other) at most `missingPerKind` gaps and `havePerKind` shown skills. */
  rows: SkillGapRow[]
}

/**
 * Per skill, how many of the member's best-fit employers ask for it, whether the member
 * shows it, and whether it is an AI skill — so the AI skills / Other skills / All choice
 * (ai-view.ts) can split one list. Each employer counts once per skill, as in
 * aggregateSkillGaps. Skills only one employer asks for are left out when at least
 * MIN_EMPLOYERS_FOR_ROW others clear the bar.
 */
export function skillGapByKind(
  jobs: { companyKey: string; gap: JobSkillGap }[],
  isAi: (term: string) => boolean,
  opts: { missingPerKind?: number; havePerKind?: number } = {}
): SkillGapByKind {
  const missingPerKind = opts.missingPerKind ?? 6
  const havePerKind = opts.havePerKind ?? 3
  const asked = new Map<string, { employers: Set<string>; have: boolean }>()
  const withData = new Set<string>()
  const withAi = new Set<string>()
  for (const { companyKey, gap } of jobs) {
    if (gap.basis === 'none') continue
    withData.add(companyKey)
    if ((gap.ai?.asked.length ?? 0) > 0) withAi.add(companyKey)
    for (const t of gap.requested) {
      const e = asked.get(t) ?? asked.set(t, { employers: new Set(), have: gap.have.includes(t) }).get(t)!
      e.employers.add(companyKey)
    }
  }
  const all = [...asked.entries()]
    .map(([term, e]) => ({ term, employers: e.employers.size, have: e.have, ai: isAi(term) }))
    .sort((a, b) => b.employers - a.employers || a.term.localeCompare(b.term))
  const pick = (ai: boolean, have: boolean, n: number) => {
    const list = all.filter((r) => r.ai === ai && r.have === have)
    const repeated = list.filter((r) => r.employers >= MIN_EMPLOYERS_FOR_ROW)
    return (repeated.length >= MIN_EMPLOYERS_FOR_ROW ? repeated : list).slice(0, n)
  }
  const missing = [...pick(true, false, missingPerKind), ...pick(false, false, missingPerKind)]
  const have = [...pick(true, true, havePerKind), ...pick(false, true, havePerKind)]
  const byCount = (a: SkillGapRow, b: SkillGapRow) => b.employers - a.employers || a.term.localeCompare(b.term)
  return {
    jobsConsidered: jobs.length,
    employersWithSkillData: withData.size,
    employersAskingAi: withAi.size,
    rows: [...missing.sort(byCount), ...have.sort(byCount)],
  }
}
