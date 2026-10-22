// Job board search — the pure part: URL parameters, query parsing, matching and
// location logic. No I/O; the per-row index it matches against is built in
// board-search-index.ts, and the ranking it feeds is in board-shortlist.ts
// (rankBoardRows' relevance / sort options). Tested in src/test/board-search.test.ts.
//
// Search runs over the shared in-memory board, never the database: every row is
// matched with string `includes` against a few normalized fields, so a search over
// the whole board is a few tens of milliseconds.
//
// Semantics:
// - Free words are ANDed. Each must start a word somewhere in the job's title,
//   function / occupation / skills, or company / industry ("engineer" matches
//   "Engineering"); words of 3 letters or fewer must be a whole word ("vp" never
//   matches "vpn").
// - "Quoted phrases" must appear as whole words, in order.
// - Abbreviations and their spelled-out forms are interchangeable (SYNONYM_GROUPS):
//   VP = vice president, PM = product manager, FP&A = financial planning and analysis…
// - company:Stripe or company:"Goldman Sachs" keeps one company; -word drops jobs
//   whose title or company has that word.
// - Matching ignores case, accents and punctuation ("FP&A" = "fpa", "Sr." = "sr").
//
// Relevance tiers (lower is better): 0 the whole query as a phrase in the title,
// 1 every word in the title, 2 the weakest word matched the function / occupation /
// skills, 3 the weakest word matched only the company or industry.

import { statesFromLocation } from '@/lib/pay/market-pay'
import { SHARED_METRO_STATES } from '@/lib/jobs/metro-states'

// ── URL parameters ──────────────────────────────────────────────────────────

export const BOARD_SORTS = ['best', 'newest', 'pay', 'ai_most', 'ai_least'] as const
export type BoardSort = (typeof BOARD_SORTS)[number]
// ai_most / ai_least: AI exposure from the Anthropic Economic Index (src/lib/aei/job-exposure.ts).
export const BOARD_SORT_LABEL: Record<BoardSort, string> = {
  best: 'Best match',
  newest: 'Newest',
  pay: 'Highest pay',
  ai_most: 'Most exposed to AI',
  ai_least: 'Least exposed to AI',
}
/** Sorts by AI exposure (they need the AEI rank, board-server.ts). */
export const isExposureSort = (s: BoardSort | undefined): boolean => s === 'ai_most' || s === 'ai_least'

export const REMOTE_FILTERS = ['remote', 'hybrid', 'onsite'] as const
export type RemoteFilter = (typeof REMOTE_FILTERS)[number]
export const REMOTE_FILTER_LABEL: Record<RemoteFilter, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }

export interface BoardSearchParams {
  q: string
  loc: string
  remote: RemoteFilter | null
  sort: BoardSort
}

export const EMPTY_BOARD_SEARCH: BoardSearchParams = { q: '', loc: '', remote: null, sort: 'best' }

const MAX_PARAM = 200

/** The search's URL parameters (q, loc, remote, sort), cleaned. Unknown values fall back to the defaults. */
export function parseBoardSearchParams(sp: { q?: string | string[] | null; loc?: string | string[] | null; remote?: string | string[] | null; sort?: string | string[] | null }): BoardSearchParams {
  const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const q = one(sp.q).replace(/\s+/g, ' ').trim().slice(0, MAX_PARAM)
  let loc = one(sp.loc).replace(/\s+/g, ' ').trim().slice(0, MAX_PARAM)
  let remote = (REMOTE_FILTERS as readonly string[]).includes(one(sp.remote)) ? (one(sp.remote) as RemoteFilter) : null
  // "Remote" typed as the location is the remote filter.
  if (/^remote$/i.test(loc)) {
    loc = ''
    remote = 'remote'
  }
  const sort = (BOARD_SORTS as readonly string[]).includes(one(sp.sort)) ? (one(sp.sort) as BoardSort) : 'best'
  return { q, loc, remote, sort }
}

/** Writes the search into a copy of the current URL parameters, dropping defaults (so a cleared search leaves a clean URL). */
export function withBoardSearchParams(current: URLSearchParams | string, s: BoardSearchParams): URLSearchParams {
  const next = new URLSearchParams(typeof current === 'string' ? current : current.toString())
  const set = (k: string, v: string | null) => (v ? next.set(k, v) : next.delete(k))
  set('q', s.q.trim() || null)
  set('loc', s.loc.trim() || null)
  set('remote', s.remote)
  set('sort', s.sort === 'best' ? null : s.sort)
  return next
}

/** Whether anything narrows the board (a sort alone only reorders it). */
export function isSearchActive(s: BoardSearchParams): boolean {
  return s.q !== '' || s.loc !== '' || s.remote !== null
}

// ── Normalizing ─────────────────────────────────────────────────────────────

/**
 * Lowercase, accents and punctuation removed, single spaces, padded with a space at
 * each end so a word start is always `' ' + word`. "FP&A" → " fpa ", "C++" → " cplusplus ".
 */
export function normalizeSearchText(s: string | null | undefined): string {
  if (!s) return ' '
  const t = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/c#/g, 'csharp')
    .replace(/\.net\b/g, ' dotnet')
    // Letter&letter is one word (FP&A, M&A, P&L, R&D); a spaced & is "and".
    .replace(/([a-z0-9])\s*&\s*([a-z0-9])(?=[^a-z0-9]|$)/g, (m, a: string, b: string) => (/\s/.test(m) ? `${a} and ${b}` : `${a}${b}`))
    .replace(/&/g, ' and ')
    // Dotted abbreviations: "Sr." → "sr", "U.S." → "us".
    .replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  // join, not a template: one flat string, not a rope of three (the index holds ~200k of these).
  return t ? [' ', t, ' '].join('') : ' '
}

// ── Synonyms ────────────────────────────────────────────────────────────────

/** Interchangeable forms, already normalized. The first is the label. */
export const SYNONYM_GROUPS: string[][] = [
  ['vp', 'vice president'],
  ['svp', 'senior vice president'],
  ['evp', 'executive vice president'],
  ['avp', 'assistant vice president'],
  ['ceo', 'chief executive officer'],
  ['cfo', 'chief financial officer'],
  ['coo', 'chief operating officer'],
  ['cto', 'chief technology officer'],
  ['cio', 'chief information officer'],
  ['cmo', 'chief marketing officer'],
  ['cro', 'chief revenue officer'],
  ['chro', 'chief human resources officer', 'chief people officer'],
  ['ciso', 'chief information security officer'],
  ['cpo', 'chief product officer'],
  ['cdo', 'chief data officer'],
  ['cco', 'chief commercial officer'],
  ['gc', 'general counsel'],
  ['gm', 'general manager'],
  ['md', 'managing director'],
  ['pm', 'product manager'],
  ['tpm', 'technical program manager'],
  ['swe', 'software engineer', 'software developer'],
  ['sre', 'site reliability engineer'],
  ['hrbp', 'hr business partner', 'human resources business partner'],
  ['hr', 'human resources'],
  ['fpa', 'financial planning and analysis'],
  ['ma', 'mergers and acquisitions'],
  ['rd', 'research and development'],
  ['bd', 'business development'],
  ['ea', 'executive assistant'],
  ['ai', 'artificial intelligence'],
  ['ml', 'machine learning'],
  ['ux', 'user experience'],
  ['ui', 'user interface'],
  ['qa', 'quality assurance'],
  ['it', 'information technology'],
  ['ir', 'investor relations'],
  ['pr', 'public relations'],
  ['cpa', 'certified public accountant'],
  ['rn', 'registered nurse'],
  ['np', 'nurse practitioner'],
  ['sr', 'senior'],
  ['jr', 'junior'],
  ['mgr', 'manager'],
  ['dir', 'director'],
  ['eng', 'engineering'],
  ['ops', 'operations'],
  ['acct', 'accountant'],
  ['admin', 'administrator', 'administrative'],
  ['exec', 'executive'],
  ['devops', 'dev ops'],
  ['fde', 'forward deployed engineer'],
]

const SYNONYMS = new Map<string, string[]>()
for (const group of SYNONYM_GROUPS) for (const form of group) SYNONYMS.set(form, group)
const MAX_SYNONYM_WORDS = Math.max(...SYNONYM_GROUPS.flat().map((f) => f.split(' ').length))

// Never a search word on their own ("vp of finance jobs" → vp, finance).
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'for', 'in', 'at', 'to', 'with', 'job', 'jobs', 'role', 'roles', 'position', 'positions', 'opening', 'openings'])

// ── Query parsing ───────────────────────────────────────────────────────────

export const MAX_TERMS = 30

/** One search word: any of its forms must match. `exact` (quoted phrases) needs whole words. */
export interface SearchTerm {
  forms: string[]
  exact: boolean
  /** The forms as the padded strings searched for (see needle: short words and phrases whole, longer words as a word start), built once per query. */
  needles: string[]
}

const needle = (form: string, exact: boolean) => (exact || form.length <= 3 ? ` ${form} ` : ` ${form}`)
const term = (forms: string[], exact: boolean): SearchTerm => ({ forms, exact, needles: forms.map((f) => needle(f, exact)) })

export interface ParsedQuery {
  terms: SearchTerm[]
  /** company: filters, normalized (any one must match the company). */
  companies: string[]
  /** -word exclusions, normalized. */
  excludes: string[]
  /** The free words as one normalized phrase (for the "whole query in the title" tier). */
  phrase: string
  phraseNeedle: string
  companyNeedles: string[]
  excludeNeedles: string[]
}

// Plural / "-s" forms: "engineers" also finds "engineer…", "analytics" "analytic…".
function stem(word: string): string {
  return word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
}

function termsFromWords(words: string[]): SearchTerm[] {
  const out: SearchTerm[] = []
  for (let i = 0; i < words.length; ) {
    let matched = false
    for (let n = Math.min(MAX_SYNONYM_WORDS, words.length - i); n >= 1; n--) {
      const group = SYNONYMS.get(words.slice(i, i + n).join(' '))
      if (group) {
        out.push(term(group, false))
        i += n
        matched = true
        break
      }
    }
    if (matched) continue
    const w = words[i++]
    if (STOP_WORDS.has(w)) continue
    out.push(term([stem(w)], false))
  }
  return out
}

/** Parses the keyword box: "quoted phrases", company:Name / company:"Two words", -exclusions, synonyms. */
export function parseSearchQuery(q: string): ParsedQuery {
  const companies: string[] = []
  const excludes: string[] = []
  const terms: SearchTerm[] = []
  const free: string[] = []
  // Plain words are read together, so multi-word forms ("vice president") are found across them.
  let words: string[] = []
  const flush = () => {
    if (words.length > 0) terms.push(...termsFromWords(words))
    words = []
  }
  // company:"x y" | company:x | -"x y" | -x | "x y" | x
  const re = /(-)?(?:(company|co):)?(?:"([^"]*)"?|(\S+))/gi
  for (const m of q.matchAll(re)) {
    const negate = !!m[1]
    const field = m[2]?.toLowerCase()
    const quoted = m[3]
    const raw = quoted ?? m[4] ?? ''
    const norm = normalizeSearchText(raw).trim()
    if (!norm) continue
    if (field || negate || quoted !== undefined) flush()
    if (field) {
      if (!negate) companies.push(norm)
      else excludes.push(norm)
    } else if (negate) {
      excludes.push(norm)
    } else if (quoted !== undefined) {
      terms.push(term([norm], true))
      free.push(norm)
    } else {
      free.push(norm)
      words.push(...norm.split(' '))
    }
  }
  flush()
  // Words past MAX_TERMS are ignored (matching keeps one bit per word).
  terms.splice(MAX_TERMS)
  return {
    terms,
    companies,
    excludes,
    phrase: free.join(' '),
    phraseNeedle: ` ${free.join(' ')}`,
    companyNeedles: companies.map((c) => ` ${c}`),
    excludeNeedles: excludes.map((x) => ` ${x} `),
  }
}

export function isEmptyQuery(p: ParsedQuery): boolean {
  return p.terms.length === 0 && p.companies.length === 0 && p.excludes.length === 0
}

// ── Matching ────────────────────────────────────────────────────────────────

/** A job's searchable text, each field normalized (normalizeSearchText). */
export interface SearchDoc {
  title: string
  /** Inferred / target function, O*NET occupation title, skills — each normalized. */
  role: readonly string[]
  company: string
  industry: string
}

function termIn(hay: string, t: SearchTerm): boolean {
  for (const n of t.needles) if (hay.includes(n)) return true
  return false
}

function termInAny(hays: readonly string[], t: SearchTerm): boolean {
  for (const h of hays) if (termIn(h, t)) return true
  return false
}

/** Bit k set when the query's term k is in hay (at most MAX_TERMS terms). */
export function termsMask(hay: string, terms: readonly SearchTerm[]): number {
  let bits = 0
  for (let k = 0; k < terms.length; k++) if (termIn(hay, terms[k])) bits |= 1 << k
  return bits
}

/** The relevance tier (0 best … 3), or null when the job doesn't match. */
export function matchSearchDoc(doc: SearchDoc, q: ParsedQuery): number | null {
  return matchLazy(doc.title, doc.company, doc, (d) => d.role, (d) => d.industry, q)
}

/**
 * matchSearchDoc with the slower fields read only when a word isn't in the title
 * (the board matches every row on each search, and most words are decided by the
 * title). role / industry are called with ctx, so callers needn't allocate a closure per row.
 */
export function matchLazy<C>(
  title: string,
  company: string,
  ctx: C,
  role: (ctx: C) => readonly string[],
  industry: (ctx: C) => string,
  q: ParsedQuery
): number | null {
  for (const c of q.companyNeedles) if (!company.includes(c)) return null
  for (const x of q.excludeNeedles) if (title.includes(x) || company.includes(x)) return null
  if (q.terms.length === 0) return 0
  let worst = 1
  let roleParts: readonly string[] | null = null
  for (const t of q.terms) {
    if (termIn(title, t)) continue
    if (termInAny((roleParts ??= role(ctx)), t)) {
      worst = Math.max(worst, 2)
      continue
    }
    if (termIn(company, t) || termIn(industry(ctx), t)) {
      worst = 3
      continue
    }
    return null
  }
  if (worst === 1 && q.phrase && title.includes(q.phraseNeedle)) return 0
  return worst
}

// ── Location ────────────────────────────────────────────────────────────────

export interface LocationQuery {
  /** States the job must be in (any of), empty for no state constraint. */
  states: string[]
  /** A city the job's location must name (normalized, no padding), or null. */
  city: string | null
}

/** Metro areas offered in the location typeahead, by anchor state (loc=New York metro, or loc=metro:NY). */
export const METROS: { key: string; label: string }[] = [
  { key: 'NY', label: 'New York metro' },
  { key: 'PA', label: 'Philadelphia metro' },
  { key: 'DC', label: 'Washington, DC metro' },
  { key: 'MA', label: 'Boston metro' },
]

export function metroStates(key: string): string[] {
  return [key, ...(SHARED_METRO_STATES[key] ?? [])]
}

export function metroLabel(key: string): string {
  const m = METROS.find((x) => x.key === key)
  return m ? `${m.label} (${metroStates(key).join(', ')})` : key
}

const STATE_NAMES = new Set(
  ('alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa ' +
    'kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ' +
    'ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming')
    .split(' ')
    .concat(['new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'rhode island', 'south carolina', 'south dakota', 'west virginia', 'district of columbia', 'puerto rico'])
)

/**
 * The location box: "metro:NY", a state ("TX", "Texas"), a city with or without its
 * state ("Austin, TX", "New York, NY", "Boston"). With a comma the first part is
 * always the city. null when empty or unreadable.
 */
export function parseLocationQuery(loc: string): LocationQuery | null {
  const text = loc.trim()
  if (!text) return null
  const metro = /^metro:([A-Za-z]{2})$/.exec(text)
  if (metro) return { states: metroStates(metro[1].toUpperCase()), city: null }
  // "New York metro" (what the typeahead puts in the box), with or without its states.
  const named = METROS.find((m) => text.toLowerCase().replace(/\s*\(.*\)\s*$/, '') === m.label.toLowerCase())
  if (named) return { states: metroStates(named.key), city: null }
  const states = statesFromLocation(/^[A-Za-z]{2}$/.test(text) ? text.toUpperCase() : text).states
  const first = normalizeSearchText(text.split(',')[0]).trim()
  const firstIsState = !text.includes(',') && (STATE_NAMES.has(first) || (first.length === 2 && states.length > 0))
  const city = first && !firstIsState ? first : null
  if (states.length === 0 && !city) return null
  return { states, city }
}

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite'

/** Where a job is, for the location filter. */
export interface PlaceDoc {
  states: readonly string[]
  /** Location text plus city, normalized. */
  text: string
  arrangement: WorkArrangement | null
}

/** A job's work arrangement: the import's field when it has one, else the location text. */
export function workArrangementOf(field: string | null | undefined, location: string | null | undefined, targetRemotePolicy?: string | null): WorkArrangement | null {
  const f = field?.toLowerCase()
  if (f === 'remote' || f === 'hybrid' || f === 'onsite') return f
  if (location && /\bremote\b/i.test(location)) return 'remote'
  if (location && /\bhybrid\b/i.test(location)) return 'hybrid'
  const t = targetRemotePolicy?.toLowerCase()
  if (t === 'remote' || t === 'hybrid' || t === 'onsite') return t
  return null
}

/**
 * Location and remote filters together. A remote job is never tied to a city, so
 * with the Remote filter a location narrows to remote jobs open there (or open
 * anywhere). On-site is everything not marked remote or hybrid (most jobs say nothing).
 */
export function matchPlace(place: PlaceDoc, loc: LocationQuery | null, remote: RemoteFilter | null): boolean {
  const arr = place.arrangement
  if (remote === 'remote' && arr !== 'remote') return false
  if (remote === 'hybrid' && arr !== 'hybrid') return false
  if (remote === 'onsite' && (arr === 'remote' || arr === 'hybrid')) return false
  if (!loc) return true
  if (remote === 'remote') return place.states.length === 0 || loc.states.length === 0 || place.states.some((s) => loc.states.includes(s))
  if (loc.states.length > 0 && !place.states.some((s) => loc.states.includes(s))) return false
  if (loc.city && !place.text.includes(` ${loc.city} `)) return false
  return true
}

/** Annual pay for sorting: the top of the range, hourly figures × 2080. null when none. */
export function annualPayForSort(salaryMin: number | null, salaryMax: number | null): number | null {
  const v = salaryMax ?? salaryMin
  if (!v || v <= 0) return null
  return v < 1_000 ? v * 2_080 : v
}
