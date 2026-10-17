// Match a member's role to the occupation titles on public wage filings
// (DOL LCA, stored as OfferedWageSummary). Filings name an occupation such as
// "Financial Managers" or "Software Developers", not a job title, so this is a
// careful word match: a filing counts only when it shares a meaningful word
// with the member's role. Pure, so the matching can be tested.

const NOISE = new Set([
  'senior', 'sr', 'jr', 'junior', 'lead', 'principal', 'staff', 'head', 'chief', 'vp', 'svp', 'evp', 'vice', 'president',
  'associate', 'assistant', 'of', 'the', 'and', 'for', 'a', 'in', 'at', 'to', 'all', 'other', 'executive', 'officer',
])
// Words that appear in many occupation titles and say little about which one.
const GENERIC = new Set(['manager', 'managers', 'director', 'directors', 'specialist', 'specialists', 'engineer', 'engineers'])

function stem(w: string): string {
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w
}

export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
}

// 0 to 1. Zero unless the role and the occupation share at least one word that
// is neither noise nor generic ("marketing", "financial", "software").
export function matchScore(role: string, socTitle: string): number {
  const roleWords = wordsOf(role).filter((w) => !NOISE.has(w))
  const socWords = new Set(wordsOf(socTitle))
  if (roleWords.length === 0) return 0
  const shared = roleWords.filter((w) => socWords.has(w))
  const meaningful = shared.filter((w) => !GENERIC.has(w))
  if (meaningful.length === 0) return 0
  return shared.length / roleWords.length
}

export const MIN_MATCH = 0.5

export type WageRow = { employerName: string; socTitle: string; filings: number; wageP25: number; wageMedian: number; wageP75: number; topState: string | null }

export function matchWages<T extends WageRow>(role: string, rows: T[]): (T & { score: number })[] {
  return rows
    .map((r) => ({ ...r, score: matchScore(role, r.socTitle) }))
    .filter((r) => r.score >= MIN_MATCH)
    .sort((a, b) => b.score - a.score || b.filings - a.filings)
}

// Across employers: each filing counts once, so a company with many filings
// weighs more. A summary has only three quantiles, so the pooled figure is the
// filings-weighted median of the per-company medians (an estimate, and labelled).
export function pooledMedian<K extends 'wageP25' | 'wageMedian' | 'wageP75' = 'wageMedian'>(
  rows: ({ filings: number } & Record<K, number>)[],
  key: K = 'wageMedian' as K,
): number | null {
  const total = rows.reduce((s, r) => s + r.filings, 0)
  if (total === 0) return null
  const sorted = [...rows].sort((a, b) => a[key] - b[key])
  let seen = 0
  for (const r of sorted) {
    seen += r.filings
    if (seen >= total / 2) return r[key]
  }
  return sorted[sorted.length - 1][key]
}

export function totalFilings(rows: { filings: number }[]): number {
  return rows.reduce((s, r) => s + r.filings, 0)
}
