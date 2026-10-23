// Resume keyword match for any job (Teal parity, 2026-10-23): the skills and tools a job names, and
// which of them the member's resume shows, as one score with matched and missing keywords.
//
// Deterministic, no AI, nothing per use. Two sources of what a job asks for:
//  - the fixed skill vocabulary the board already scans postings with (extractTopSkills), or the
//    posting's stored `skills` when the crawler saved them from the full text; and
//  - O*NET tools, from the posting's stored `skillIds` plus the safe in-text aliases (textSkillIds).
// The member side is their resume keywords and confirmed skills (memberSkillKeywords), plus the O*NET
// tools those keywords evidence through the SkillAlias layer (resolveSkillIds). A keyword counts only on
// a whole-word match ("ad" never matches "advertising").
// Pure: the caller loads skill names and alias ids. Tests: src/test/keyword-match.test.ts.

import { extractTopSkills } from '@/lib/companies/skills-extraction'
import { textSkillIds } from '@/lib/careers/text-skill-ids'
import { memberHasSkill } from '@/lib/jobs/job-skill-gap'

export interface KeywordMatchInput {
  /** The job's title and description (or pasted text). */
  jobText: string | null
  /** ExclusiveJobPosting.skills: vocabulary terms the crawler read from the full posting. */
  jobSkills?: string[]
  /** ExclusiveJobPosting.skillIds: O*NET tool ids. */
  jobSkillIds?: string[]
  /** memberSkillKeywords(profile). */
  memberKeywords: string[]
  /** O*NET tool ids the member's keywords evidence (SkillAlias + text aliases). */
  memberSkillIds: ReadonlySet<string>
  /** O*NET tool id -> display name, for the ids in play. An id without a name is not shown. */
  skillNames: ReadonlyMap<string, string>
}

export interface KeywordMatch {
  /** Share of the job's keywords the resume shows, 0-100; null when the job names too few to score. */
  score: number | null
  matched: string[]
  missing: string[]
}

/** Below this many recognised keywords a score would be noise. */
export const MIN_KEYWORDS_FOR_SCORE = 3
export const MAX_KEYWORDS = 20

/**
 * O*NET also lists software categories ("Workflow software", "Retirement planning software") that a
 * generic phrase in a posting triggers — a 401(k) line named "Retirement planning software" on a leasing
 * job. They are not keywords a resume should carry, so only named products count ("Salesforce software").
 */
const GENERIC_TOOL =
  /^(?:[a-z0-9 &/,-]*\b(?:planning|management|tracking|scheduling|analysis|analytics|accounting|mapping|debugging|workflow|database|graphics|design|presentation|spreadsheet|word processing|electronic mail|email|video|web page|project|resource|financial|capacity|data|document|inventory|customer relationship|enterprise resource|human resources|calendar|time|office suite|operating system|development environment|desktop|cloud|network|security|backup|testing|compliance|medical|tax|payroll|point of sale|map|routing|communication)\b[a-z0-9 &/,-]*) software$|^software libraries$|architecture$/i

export function isGenericTool(name: string): boolean {
  return GENERIC_TOOL.test(name.trim())
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim()

/** Every O*NET tool id the job names: its stored ids and the ones its text names. */
export function jobToolIds(input: Pick<KeywordMatchInput, 'jobText' | 'jobSkillIds'>): Set<string> {
  const ids = new Set(input.jobSkillIds ?? [])
  for (const id of textSkillIds(input.jobText)) ids.add(id)
  return ids
}

export function keywordMatch(input: KeywordMatchInput): KeywordMatch {
  const stored = (input.jobSkills ?? []).filter(Boolean)
  const vocab = stored.length > 0 ? stored : input.jobText ? extractTopSkills([input.jobText], MAX_KEYWORDS).map((s) => s.term) : []

  const seen = new Set<string>()
  const wanted: { name: string; have: boolean }[] = []
  for (const term of vocab) {
    const k = norm(term)
    if (!k || seen.has(k)) continue
    seen.add(k)
    wanted.push({ name: term, have: memberHasSkill(term, input.memberKeywords) })
  }
  for (const id of jobToolIds(input)) {
    const name = input.skillNames.get(id)
    if (!name || isGenericTool(name)) continue
    const k = norm(name)
    // The same skill found both ways shows once, by the vocabulary's name.
    if (!k || seen.has(k) || [...seen].some((s) => s.length >= 3 && (` ${k} `.includes(` ${s} `) || ` ${s} `.includes(` ${k} `)))) continue
    seen.add(k)
    wanted.push({ name, have: input.memberSkillIds.has(id) || memberHasSkill(name, input.memberKeywords) })
  }

  const capped = wanted.slice(0, MAX_KEYWORDS)
  const matched = capped.filter((w) => w.have).map((w) => w.name)
  const missing = capped.filter((w) => !w.have).map((w) => w.name)
  const score = capped.length >= MIN_KEYWORDS_FOR_SCORE ? Math.round((100 * matched.length) / capped.length) : null
  return { score, matched, missing }
}

/** "Strong match", "Partial match", "Weak match": the plain word beside the number. */
export function keywordMatchLabel(score: number): string {
  if (score >= 70) return 'Strong match'
  if (score >= 40) return 'Partial match'
  return 'Weak match'
}
