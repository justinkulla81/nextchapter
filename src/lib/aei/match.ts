// Matches free-text job posting titles to the occupations in the AEI exposure
// file. Conservative on purpose: a title that does not clearly match stays
// unmatched and is reported, never forced into an occupation.
import type { ExposureRow } from './exposure'

export interface TitleMatch {
  socCode: string
  title: string
  exposure: number
  score: number
  method: 'exact' | 'alternate' | 'alias' | 'fuzzy'
}

/** Minimum token overlap (Jaccard) for a fuzzy match. High on purpose: near-exact only. */
export const MIN_FUZZY_SCORE = 0.75

const LEVEL_WORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'entry', 'level', 'intern', 'trainee',
  'remote', 'hybrid', 'contract', 'contractor', 'temporary', 'temp', 'parttime', 'fulltime', 'full', 'part', 'time',
  'i', 'ii', 'iii', 'iv', 'v', 'the', 'a', 'an', 'of', 'for', 'and',
])

/** Job-title words that name the same occupation as the AEI/SOC wording. */
const SYNONYMS: Record<string, string> = {
  engineer: 'developer',
  programmer: 'developer',
  rep: 'representative',
  assoc: 'associate',
  admin: 'administrator',
  hr: 'human resources',
  mgr: 'manager',
  dir: 'director',
}

function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

/** Lowercases, drops location/team tails, parentheses, levels and numerals, and stems. */
export function normalizeTitle(raw: string): string {
  let t = raw.toLowerCase()
  t = t.replace(/\([^)]*\)/g, ' ')
  t = t.split(/\s[-–—|@]\s|,|;|\/(?=\s)|\bat\b/)[0] ?? t
  t = t.replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ')
  const tokens = t
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !LEVEL_WORDS.has(w) && !/^\d+$/.test(w))
    .map(stem)
    .map((w) => SYNONYMS[w] ?? w)
    .flatMap((w) => w.split(' '))
  return tokens.join(' ')
}

interface IndexEntry {
  row: ExposureRow
  tokens: Set<string>
  head: string
  method: 'exact' | 'alternate' | 'alias'
}

export interface TitleIndex {
  /** Normalized title to entry; null when two occupations claim the same title. */
  byKey: Map<string, IndexEntry | null>
  /** Full occupation titles only, for the near-exact fuzzy pass. */
  entries: IndexEntry[]
}

/**
 * "Accountants and Auditors" also answers to each side. Only plain "A and B"
 * titles are split (never lists with commas or "Except" clauses), and a part must
 * be a plural noun or more than one word, so "General" alone is never an alias.
 */
function alternatesOf(title: string): string[] {
  const t = title.replace(/\([^)]*\)/g, ' ').trim()
  if (/\ball other\b/i.test(t) || /,|\bexcept\b/i.test(t)) return []
  const parts = t.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return []
  return parts.filter((p) => p.split(/\s+/).length > 1 || /s$/i.test(p))
}

/**
 * Curated high-volume job titles whose occupation is not in doubt. Keyed by the
 * normalized title; only used when the occupation is in the loaded exposure file.
 */
const ALIASES: Record<string, string> = {
  'chief executive officer': '11-1011', ceo: '11-1011',
  'chief financial officer': '11-3031', cfo: '11-3031', controller: '11-3031', 'assistant controller': '11-3031',
  'corporate controller': '11-3031', 'finance manager': '11-3031', 'director finance': '11-3031',
  'chief operating officer': '11-1021', 'general manager': '11-1021', president: '11-1021',
  'operation manager': '11-1021',
  recruiter: '13-1071', 'technical recruiter': '13-1071', 'corporate recruiter': '13-1071',
  'recruiting coordinator': '13-1071', 'hr generalist': '13-1071', 'human resources generalist': '13-1071',
  'hr business partner': '13-1071', 'human resources business partner': '13-1071', 'talent acquisition specialist': '13-1071',
  'talent acquisition partner': '13-1071',
  'administrative assistant': '43-6014', 'executive assistant': '43-6011', 'executive administrative assistant': '43-6011',
  'payroll specialist': '43-3051', 'payroll manager': '11-3031',
  'accounts payable specialist': '43-3031', 'accounts receivable specialist': '43-3031', 'billing specialist': '43-3031',
  attorney: '23-1011', 'associate attorney': '23-1011', 'litigation attorney': '23-1011', 'corporate counsel': '23-1011',
  'associate general counsel': '23-1011',
  'litigation paralegal': '23-2011', 'legal assistant': '23-2011',
  'logistics coordinator': '13-1081', 'logistics manager': '13-1081', 'supply chain analyst': '13-1081',
  'ux designer': '15-1255', 'ui ux designer': '15-1255', 'product designer': '15-1255',
  'marketing coordinator': '13-1161', 'marketing specialist': '13-1161', 'social media manager': '11-2021',
  'product marketing manager': '11-2021', 'brand manager': '11-2021',
  'financial analyst': '13-2051', 'credit analyst': '13-2041', 'senior credit analyst': '13-2041',
  underwriter: '13-2053', 'mortgage loan officer': '13-2072',
  'systems administrator': '15-1244', 'system administrator': '15-1244',
  'data scientist': '15-2051', 'machine learning developer': '15-2051', 'ai developer': '15-1252',
  'site reliability developer': '15-1252', 'devops developer': '15-1252', 'security developer': '15-1212',
  'facility manager': '11-3013', 'facilities manager': '11-3013',
  'construction project manager': '11-9021', 'construction manager': '11-9021',
  'engineering manager': '11-9041', 'director engineering': '11-9041', 'head engineering': '11-9041',
  'sales manager': '11-2022', 'regional sales manager': '11-2022', 'director sale': '11-2022', 'vice president sale': '11-2022',
  'human resource manager': '11-3121', 'hr manager': '11-3121', 'human resources director': '11-3121',
}

export function buildTitleIndex(rows: ExposureRow[]): TitleIndex {
  const byKey = new Map<string, IndexEntry | null>()
  const entries: IndexEntry[] = []
  const bySoc = new Map(rows.map((r) => [r.socCode, r]))
  const add = (row: ExposureRow, text: string, method: 'exact' | 'alternate') => {
    if (/\ball other\b/i.test(text)) return
    const key = normalizeTitle(text)
    if (!key) return
    const entry: IndexEntry = { row, tokens: new Set(key.split(' ')), head: key.split(' ').at(-1) ?? '', method }
    const existing = byKey.get(key)
    if (existing === undefined) byKey.set(key, entry)
    else if (existing === null) { /* already ambiguous */ }
    else if (existing.row.socCode !== row.socCode) {
      // A full title beats another occupation's alternate; otherwise the title is ambiguous.
      if (existing.method === 'alternate' && method === 'exact') byKey.set(key, entry)
      else if (!(existing.method === 'exact' && method === 'alternate')) byKey.set(key, null)
    }
    if (method === 'exact') entries.push(entry)
  }
  for (const row of rows) {
    add(row, row.title, 'exact')
    for (const alt of alternatesOf(row.title)) add(row, alt, 'alternate')
  }
  for (const [text, code] of Object.entries(ALIASES)) {
    const row = bySoc.get(code)
    const key = normalizeTitle(text)
    if (row && key) byKey.set(key, { row, tokens: new Set(key.split(' ')), head: key.split(' ').at(-1) ?? '', method: 'alias' })
  }
  return { byKey, entries }
}

export function matchTitle(rawTitle: string, index: TitleIndex): TitleMatch | null {
  const key = normalizeTitle(rawTitle)
  if (!key) return null
  const hit = index.byKey.get(key)
  if (hit === null) return null // two occupations claim this title; do not guess
  if (hit) {
    return { socCode: hit.row.socCode, title: hit.row.title, exposure: hit.row.exposure, score: 1, method: hit.method }
  }
  const tokens = new Set(key.split(' '))
  const head = key.split(' ').at(-1) ?? ''
  let best: { entry: IndexEntry; score: number } | null = null
  for (const entry of index.entries) {
    if (entry.head !== head) continue // same head noun, e.g. "accountant"
    let shared = 0
    for (const t of entry.tokens) if (tokens.has(t)) shared++
    const score = shared / (entry.tokens.size + tokens.size - shared)
    if (score >= MIN_FUZZY_SCORE && (!best || score > best.score)) best = { entry, score }
  }
  if (!best) return null
  const { row } = best.entry
  return { socCode: row.socCode, title: row.title, exposure: row.exposure, score: Math.round(best.score * 100) / 100, method: 'fuzzy' }
}
