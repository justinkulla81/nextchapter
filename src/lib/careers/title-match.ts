/**
 * Maps a job title as people write it ("Sr. Mgr, Revenue Ops") onto O*NET
 * occupations, with no AI. Exact matches against the occupation title and its
 * alternate titles win outright; otherwise token overlap ranks candidates, and
 * only a clear winner is accepted without a person or a constrained AI pick.
 */

import { isCorporateDevelopmentTitle } from '@/lib/jobs/job-functions'

// Corporate development / M&A titles: O*NET lists "Development Director" under Fundraising
// Managers, so "Director, Corporate Development" could land there by token overlap.
// O*NET files M&A work under Financial and Investment Analysts ("Mergers and Acquisitions
// Associate", "M and A Banker"); the crawler's matcher (ncrawl/soc.py) uses the same code.
export const CORP_DEV_SOC = '13-2051.00'

const ABBREVIATIONS: Record<string, string> = {
  vp: 'vice president',
  svp: 'senior vice president',
  evp: 'executive vice president',
  mgr: 'manager',
  dir: 'director',
  eng: 'engineer',
  engr: 'engineer',
  admin: 'administrator',
  asst: 'assistant',
  exec: 'executive',
  hr: 'human resources',
  it: 'information technology',
  qa: 'quality assurance',
  pm: 'project manager',
  ops: 'operations',
  rep: 'representative',
  acct: 'accountant',
  sr: 'senior',
  jr: 'junior',
}

// Level markers say how senior, not what the work is. O*NET occupations are
// level-free, so they would only dilute the match.
// "assistant", "staff" and "head" are deliberately NOT here: in "Executive Assistant" and
// "Chief of Staff" they are the role itself, and removing them would leave "executive" or "chief".
const LEVEL_WORDS = new Set([
  'senior', 'junior', 'lead', 'principal', 'associate',
  'i', 'ii', 'iii', 'iv', 'v', 'entry', 'level', 'intern', 'trainee',
])
const FILLER = new Set(['of', 'the', 'and', 'for', 'to', 'in', 'at', 'a', 'an', 'amp'])

function stem(token: string): string {
  if (token.length > 3 && token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

export function titleTokens(raw: string): string[] {
  const expanded = raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t)
    .join(' ')
    .split(/\s+/)
  const kept = expanded.filter((t) => t && !FILLER.has(t) && !LEVEL_WORDS.has(t)).map(stem)
  // "Senior Vice President" must keep "senior" meaning it is a VP, but a bare
  // "Senior Engineer" should match "Engineer": drop level words only when
  // something else is left.
  return kept.length > 0 ? kept : expanded.filter((t) => t && !FILLER.has(t)).map(stem)
}

export function normalizeTitle(raw: string): string {
  return titleTokens(raw).join(' ')
}

export interface TitleEntry {
  socCode: string
  title: string
  // Normalized forms: the occupation title itself plus every alternate title.
  normalized: string
  tokens: string[]
}

export interface TitleIndex {
  entries: TitleEntry[]
  exact: Map<string, Set<string>> // normalized title -> SOC codes
  titles: Map<string, string> // SOC -> canonical title
  // token -> positions in `entries`, so a lookup only scores titles that share a word with the query
  // instead of every one of the ~60,000 alternate titles.
  byToken: Map<string, number[]>
}

export function buildTitleIndex(
  occupations: { socCode: string; title: string }[],
  altTitles: { socCode: string; title: string }[]
): TitleIndex {
  const entries: TitleEntry[] = []
  const exact = new Map<string, Set<string>>()
  const titles = new Map<string, string>()
  const byToken = new Map<string, number[]>()
  const add = (socCode: string, title: string) => {
    const tokens = titleTokens(title)
    const normalized = tokens.join(' ')
    if (!normalized) return
    const at = entries.length
    entries.push({ socCode, title, normalized, tokens })
    for (const t of new Set(tokens)) {
      const list = byToken.get(t)
      if (list) list.push(at)
      else byToken.set(t, [at])
    }
    const set = exact.get(normalized) ?? new Set<string>()
    set.add(socCode)
    exact.set(normalized, set)
  }
  for (const o of occupations) {
    titles.set(o.socCode, o.title)
    add(o.socCode, o.title)
  }
  for (const a of altTitles) add(a.socCode, a.title)
  return { entries, exact, titles, byToken }
}

export interface TitleCandidate {
  socCode: string
  title: string
  score: number
}

export type TitleMatch =
  | { kind: 'EXACT'; socCode: string; title: string; candidates: TitleCandidate[] }
  | { kind: 'FUZZY'; socCode: string; title: string; score: number; candidates: TitleCandidate[] }
  | { kind: 'AMBIGUOUS'; candidates: TitleCandidate[] }
  | { kind: 'NONE'; candidates: [] }

const FUZZY_MIN_SCORE = 0.75
const FUZZY_MIN_MARGIN = 0.1
const CANDIDATE_FLOOR = 0.34

function diceScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  let shared = 0
  for (const t of new Set(a)) if (setB.has(t)) shared++
  return (2 * shared) / (new Set(a).size + setB.size)
}

export function matchTitle(index: TitleIndex, raw: string, limit = 8): TitleMatch {
  const tokens = titleTokens(raw)
  const normalized = tokens.join(' ')
  if (!normalized) return { kind: 'NONE', candidates: [] }

  // Best score per occupation across its title and every alternate title.
  const best = new Map<string, number>()
  const seen = new Set<number>()
  for (const t of new Set(tokens)) {
    for (const at of index.byToken.get(t) ?? []) {
      if (seen.has(at)) continue
      seen.add(at)
      const e = index.entries[at]
      const score = e.normalized === normalized ? 1 : diceScore(tokens, e.tokens)
      if (score >= CANDIDATE_FLOOR && score > (best.get(e.socCode) ?? 0)) best.set(e.socCode, score)
    }
  }
  const candidates: TitleCandidate[] = [...best.entries()]
    .map(([socCode, score]) => ({ socCode, title: index.titles.get(socCode) ?? socCode, score }))
    .sort((a, b) => b.score - a.score || a.socCode.localeCompare(b.socCode))
    .slice(0, limit)

  if (isCorporateDevelopmentTitle(raw) && index.titles.has(CORP_DEV_SOC)) {
    return { kind: 'EXACT', socCode: CORP_DEV_SOC, title: index.titles.get(CORP_DEV_SOC)!, candidates }
  }

  const exact = index.exact.get(normalized)
  if (exact && exact.size === 1) {
    const socCode = [...exact][0]
    return { kind: 'EXACT', socCode, title: index.titles.get(socCode) ?? socCode, candidates }
  }
  if (candidates.length === 0) return { kind: 'NONE', candidates: [] }

  const [top, second] = candidates
  if (top.score >= FUZZY_MIN_SCORE && (!second || top.score - second.score >= FUZZY_MIN_MARGIN)) {
    return { kind: 'FUZZY', socCode: top.socCode, title: top.title, score: top.score, candidates }
  }
  return { kind: 'AMBIGUOUS', candidates }
}
