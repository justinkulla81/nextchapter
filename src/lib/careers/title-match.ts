/**
 * Maps a job title as people write it ("Sr. Mgr, Revenue Ops") onto O*NET
 * occupations, with no AI. Exact matches against the occupation title and its
 * alternate titles win outright; otherwise token overlap ranks candidates, and
 * only a clear winner is accepted without a person or a constrained AI pick.
 */

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
const LEVEL_WORDS = new Set([
  'senior', 'junior', 'lead', 'principal', 'staff', 'associate', 'assistant', 'head',
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
}

export interface TitleIndex {
  entries: TitleEntry[]
  exact: Map<string, Set<string>> // normalized title -> SOC codes
  titles: Map<string, string> // SOC -> canonical title
}

export function buildTitleIndex(
  occupations: { socCode: string; title: string }[],
  altTitles: { socCode: string; title: string }[]
): TitleIndex {
  const entries: TitleEntry[] = []
  const exact = new Map<string, Set<string>>()
  const titles = new Map<string, string>()
  const add = (socCode: string, title: string) => {
    const normalized = normalizeTitle(title)
    if (!normalized) return
    entries.push({ socCode, title, normalized })
    const set = exact.get(normalized) ?? new Set<string>()
    set.add(socCode)
    exact.set(normalized, set)
  }
  for (const o of occupations) {
    titles.set(o.socCode, o.title)
    add(o.socCode, o.title)
  }
  for (const a of altTitles) add(a.socCode, a.title)
  return { entries, exact, titles }
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
  for (const e of index.entries) {
    const score = e.normalized === normalized ? 1 : diceScore(tokens, e.normalized.split(' '))
    if (score >= CANDIDATE_FLOOR && score > (best.get(e.socCode) ?? 0)) best.set(e.socCode, score)
  }
  const candidates: TitleCandidate[] = [...best.entries()]
    .map(([socCode, score]) => ({ socCode, title: index.titles.get(socCode) ?? socCode, score }))
    .sort((a, b) => b.score - a.score || a.socCode.localeCompare(b.socCode))
    .slice(0, limit)

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
