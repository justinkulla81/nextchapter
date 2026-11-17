// "Widen your search": the strategy a member builds before the board looks past their home field and place.
// Instead of one switch on the board, the member sees where the jobs are (the cities with the most openings
// for their function, and for their function in their industry), what else to look at (industries hiring
// their kind of work, related roles that use their skills), and what their skills say about each (skills
// intelligence: what those postings ask for, shown or not; skills bridge: what carries over into a related
// role and what to add). Each pick is a search-expansion opt-in (search-expansion.ts), so Find a job, the
// fit score and the daily email read it with no new plumbing. Pure and client-safe; the server half is
// widen-strategy-server.ts. Tests: src/test/widen-strategy.test.ts.

import { skillGap, MIN_CELL, type SkillMarket } from '@/lib/skills/market'
import type { TopCity } from '@/lib/market/city-stats'

export interface WidenCity extends TopCity {
  stateName: string
  /** The member's own state: already in their search. */
  home: boolean
}

export interface WidenIndustry {
  industry: string
  openNow: number
}

export interface WidenRole {
  role: string
  label: string
  openNow: number | null
  /** Their skills that carry over into the role. */
  carry: string[]
  /** What the role asks for that they do not show yet. */
  toAdd: string[]
}

export interface SkillsIntel {
  /** The slice the counts are about, as it reads in a sentence: "finance", "Healthcare & Hospital Systems". */
  label: string
  /** Live postings in scope that name a skill: the base of every share. */
  basis: number
  have: { slug: string; name: string; share: number }[]
  missing: { slug: string; name: string; share: number }[]
}

export interface WidenStrategyView {
  /** The member's kind of work as they read it, e.g. "Finance". Null: we do not know it yet. */
  fnLabel: string | null
  homeState: string | null
  /** Cities with the most openings for their function, at their level. */
  citiesForFunction: WidenCity[]
  /** The same, inside their (first) industry. Null when they named no industry. */
  citiesForIndustry: { industry: string; cities: WidenCity[] } | null
  remoteOpen: number
  industries: WidenIndustry[]
  roles: WidenRole[]
  /** Skills intelligence for their own field, and for the industry they are most likely to add. */
  skills: SkillsIntel | null
  industrySkills: SkillsIntel | null
  /** What is already switched on (search-expansion.ts). */
  on: { remote: boolean; states: string[]; industries: string[]; roles: string[] }
  /** When they last finished the strategy (journeyDetails.widenStrategy.at). */
  savedAt: string | null
}

/** Skills intelligence for one slice of the board; null when too few postings in it name a skill to say anything. */
export function skillsIntel(m: SkillMarket | null, memberTerms: string[], scope: { dim: 'function' | 'industry'; key: string } | null, label: string, limit = 6): SkillsIntel | null {
  if (!m) return null
  const basis = scope ? (m.totals[scope.dim]?.[scope.key] ?? 0) : m.withSkills
  if (basis < MIN_CELL) return null
  const gap = skillGap(m, memberTerms, scope ?? undefined, limit)
  if (gap.have.length + gap.missing.length === 0) return null
  return { label, basis, have: gap.have, missing: gap.missing }
}

/** The skills market's key for an industry bucket ("Healthcare & Hospital Systems" to "healthcare"), the largest when several map to it. */
export function industryKeyFor(m: SkillMarket | null, bucket: string): string | null {
  if (!m) return null
  const want = bucket.trim().toLowerCase()
  let best: { key: string; n: number } | null = null
  for (const [key, label] of Object.entries(m.labels.industry ?? {})) {
    if (label.trim().toLowerCase() !== want) continue
    const n = m.totals.industry?.[key] ?? 0
    if (!best || n > best.n) best = { key, n }
  }
  return best?.key ?? null
}

/** The skills market's key for a function name: the same slug the snapshot builds (market-server.ts keyOf). */
export const functionKeyFor = (fn: string) => fn.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export interface StrategyPicks {
  remote: boolean
  states: string[]
  industries: string[]
  roles: string[]
}

/** The one-line summary of what the member has picked, which updates as they pick. Null when nothing is picked. */
export function strategySummary(p: StrategyPicks, names: { state: (s: string) => string; role: (r: string) => string }): string | null {
  const bits: string[] = []
  const places = [...p.states.map(names.state), ...(p.remote ? ['remote'] : [])]
  if (places.length > 0) bits.push(`jobs in ${joinList(places)}`)
  if (p.industries.length > 0) bits.push(`${joinList(p.industries)} employers`)
  if (p.roles.length > 0) bits.push(`${joinList(p.roles.map(names.role))} roles`)
  if (bits.length === 0) return null
  return `Your search adds ${joinList(bits)}.`
}

export function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** journeyDetails.widenStrategy, read defensively. */
export function readWidenStrategy(journeyDetails: unknown): { at: string } | null {
  const raw = (journeyDetails as { widenStrategy?: unknown } | null)?.widenStrategy as { at?: unknown } | undefined
  return raw && typeof raw.at === 'string' ? { at: raw.at } : null
}

/**
 * Whether the board's Broader / Everything switch should first send the member to build a strategy: only when they have
 * never finished one and have nothing outside home switched on. People who already widened keep the plain switch.
 */
export function needsStrategy(journeyDetails: unknown, picks: StrategyPicks, exploredOn: number): boolean {
  if (readWidenStrategy(journeyDetails)) return false
  return !picks.remote && picks.states.length === 0 && picks.industries.length === 0 && picks.roles.length === 0 && exploredOn === 0
}
