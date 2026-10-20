// What a job a member applied to asked for, and how the member's skills lined up, frozen at
// application time. Pure and client-safe; the database side is skill-snapshot-data.ts and the
// rules are tested in src/test/application-skill-snapshot.test.ts.
//
// Two bases:
//   posting   the application is linked to a board posting (application-posting-link.ts): the
//             posting's own skills (ExclusiveJobPosting.skills, read from the full description at
//             import), its AI skills (aiSkillItems) and the AI tools it names (aiToolsNamed).
//   inferred  no posting, but the title maps to an O*NET occupation: the skills that occupation's
//             open board postings ask for most (occupationAsksFromPostings), else O*NET's in-demand
//             tools for it. Weaker evidence, so it is labelled "inferred" everywhere it shows and
//             counts half as much as a posting in every roll-up (BASIS_WEIGHT).
//
// Match uses the same whole-word rules as the board's skill gap (job-skill-gap.ts memberHasSkill,
// ai-skills.ts for AI items), so a gap here and a gap on a job card never disagree.

import { memberHasSkill } from '@/lib/jobs/job-skill-gap'
import { aiSkillGap, aiSkillIdForLabel, aiToolDisplayName, isAiAlias, memberAiSkillIds } from '@/lib/skills/ai-skills'

export type SnapshotBasis = 'posting' | 'inferred'

/** An inferred snapshot counts half as much as one read from a real posting. */
export const BASIS_WEIGHT: Record<SnapshotBasis, number> = { posting: 1, inferred: 0.5 }

export const MAX_SKILLS = 10
export const MAX_TOOLS = 5
export const MAX_AI_SKILLS = 4
/** Inferred snapshots: at most this many O*NET tools, in-demand ("hot") ones first. */
export const MAX_INFERRED_TOOLS = 8

export interface SkillAsks {
  /** Posting skills (lowercase vocabulary terms, e.g. "fp&a", "sql"). */
  skills: string[]
  /** Named tools: AI tools from the posting, or O*NET technology for an inferred snapshot. */
  tools: string[]
  /** AI skill labels (ai-skills.ts), most specific first. */
  aiSkills: string[]
}

export interface SkillMatch {
  matched: string[]
  missing: string[]
  /** Share of asked skills the member shows, 0-100; null when the job asked for nothing we can read. */
  matchPct: number | null
}

const dedupe = (xs: string[]) => {
  const seen = new Set<string>()
  return xs.filter((x) => {
    const k = x.trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** What a board posting asks for. A posting skill that is one of its AI skills said another way shows once, as the AI skill. */
export function postingAsks(p: { skills?: string[] | null; aiSkillItems?: string[] | null; aiToolsNamed?: string[] | null }): SkillAsks {
  const aiItems = p.aiSkillItems ?? []
  return {
    aiSkills: aiSkillGap(aiItems, []).asked.slice(0, MAX_AI_SKILLS),
    tools: dedupe((p.aiToolsNamed ?? []).map(aiToolDisplayName)).slice(0, MAX_TOOLS),
    skills: dedupe((p.skills ?? []).filter((s) => !isAiAlias(s, aiItems))).slice(0, MAX_SKILLS),
  }
}

/** Inferred from the occupation's open postings: a skill counts when at least this share of them ask for it. */
export const MIN_OCCUPATION_SHARE = 0.08
/** ...and only when the occupation has at least this many postings with skills to read. */
export const MIN_OCCUPATION_POSTINGS = 20

/**
 * What an O*NET occupation's jobs ask for, from the board's own open postings classified to it
 * (ExclusiveJobPosting.socCode): the skills and AI skills at least MIN_OCCUPATION_SHARE of them name.
 * Same vocabulary as a posting snapshot, so inferred and posting gaps add up. Null when too few postings.
 */
export function occupationAsksFromPostings(postings: { skills: string[]; aiSkillItems?: string[] | null }[]): SkillAsks | null {
  const withSkills = postings.filter((p) => p.skills.length > 0 || (p.aiSkillItems?.length ?? 0) > 0)
  if (withSkills.length < MIN_OCCUPATION_POSTINGS) return null
  const skillN = new Map<string, number>()
  const aiN = new Map<string, number>()
  for (const p of withSkills) {
    for (const t of new Set(p.skills.map((x) => x.trim().toLowerCase()).filter(Boolean))) skillN.set(t, (skillN.get(t) ?? 0) + 1)
    for (const label of aiSkillGap(p.aiSkillItems ?? [], []).asked) aiN.set(label, (aiN.get(label) ?? 0) + 1)
  }
  const min = Math.ceil(MIN_OCCUPATION_SHARE * withSkills.length)
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([t]) => t)
  const asks = { skills: top(skillN, MAX_INFERRED_TOOLS), tools: [], aiSkills: top(aiN, 2) }
  return asks.skills.length + asks.aiSkills.length > 0 ? asks : null
}

export interface OnetElementLike {
  name: string
  kind: string
  importance: number
  hotTech: boolean
}

// Office software every desk job uses; O*NET lists it for nearly every occupation, so it says nothing about a role.
const GENERIC_TECH = /^(microsoft (office|outlook|access|word|excel|powerpoint|teams|sharepoint|visio|project)\b|adobe acrobat|google (docs|sheets|drive|workspace)|email software|web browser|extensible markup language|spreadsheet software|word processing)/i

/**
 * Last resort for an application with no posting and an occupation with too few board postings:
 * O*NET's in-demand ("hot") tools for the occupation, generic office software left out.
 */
export function inferredAsks(elements: Iterable<OnetElementLike>): SkillAsks {
  const tools = [...elements]
    .filter((e) => e.kind === 'TECHNOLOGY' && e.hotTech && e.name.trim() && !GENERIC_TECH.test(e.name.trim()))
    .sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name))
    .map((e) => e.name.trim())
  return { skills: [], tools: dedupe(tools).slice(0, MAX_INFERRED_TOOLS), aiSkills: [] }
}

/** Every asked term, AI skills first, then tools, then skills. */
export function allAsks(a: SkillAsks): string[] {
  return dedupe([...a.aiSkills, ...a.tools, ...a.skills])
}

/** The member's skills (skillTerms) against what the job asked for. */
export function matchAsks(a: SkillAsks, memberKeywords: string[]): SkillMatch {
  const asked = allAsks(a)
  if (asked.length === 0) return { matched: [], missing: [], matchPct: null }
  const aiIds = memberAiSkillIds(memberKeywords)
  const aiLabels = new Set(a.aiSkills.map((s) => s.toLowerCase()))
  const has = (term: string) => {
    if (aiLabels.has(term.toLowerCase())) {
      const id = aiSkillIdForLabel(term)
      return id ? aiIds.has(id) : memberHasSkill(term, memberKeywords)
    }
    return memberHasSkill(term, memberKeywords)
  }
  const matched = asked.filter(has)
  const missing = asked.filter((t) => !matched.includes(t))
  return { matched, missing, matchPct: Math.round((100 * matched.length) / asked.length) }
}

/** Changes whenever the member's skills do, so stored "current" match knows when to recompute. Order-insensitive. */
export function skillsHash(memberKeywords: string[]): string {
  const s = [...new Set(memberKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].sort().join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return `${h.toString(36)}-${s.length}`
}

// ── Geography ──

/** US Census regions, by state code. */
const REGION_STATES: Record<string, string[]> = {
  Northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  Midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  South: ['DE', 'DC', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX'],
  West: ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
}
const REGION_OF = new Map(Object.entries(REGION_STATES).flatMap(([r, states]) => states.map((s) => [s, r] as const)))

export function censusRegion(state: string | null | undefined): string | null {
  return (state && REGION_OF.get(state.trim().toUpperCase())) || null
}

// ── The snapshot row ──

export interface SnapshotFacts {
  industry: string | null
  jobFunction: string | null
  subFunction: string | null
  level: string | null
  locationState: string | null
  employerSector: string | null
}

export interface SnapshotDraft extends SkillAsks, SkillMatch, SnapshotFacts {
  basis: SnapshotBasis
  boardJobId: string | null
  socCode: string | null
  socTitle: string | null
  region: string | null
  skillsHash: string
}

/** Builds the frozen row: what was asked, the facts about the job, and the member's match right now. */
export function buildSnapshot(input: {
  basis: SnapshotBasis
  boardJobId?: string | null
  socCode?: string | null
  socTitle?: string | null
  asks: SkillAsks
  facts: SnapshotFacts
  memberKeywords: string[]
}): SnapshotDraft {
  const match = matchAsks(input.asks, input.memberKeywords)
  return {
    basis: input.basis,
    boardJobId: input.boardJobId ?? null,
    socCode: input.socCode ?? null,
    socTitle: input.socTitle ?? null,
    ...input.asks,
    ...input.facts,
    region: censusRegion(input.facts.locationState),
    ...match,
    skillsHash: skillsHash(input.memberKeywords),
  }
}

/**
 * Whether an existing snapshot should be replaced by a new one. A posting snapshot is history and
 * stays, unless the application now points at a different posting (a corrected link). An inferred
 * one gives way to a posting as soon as the application is linked.
 */
export function shouldReplaceSnapshot(existing: { basis: string; boardJobId: string | null } | null, next: { basis: SnapshotBasis; boardJobId: string | null }): boolean {
  if (!existing) return true
  if (existing.basis === 'inferred') return next.basis === 'posting' || existing.boardJobId !== next.boardJobId
  return next.basis === 'posting' && next.boardJobId !== existing.boardJobId
}
