import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { statesFromLocation } from '@/lib/pay/market-pay'
import type { LightRow } from '@/lib/jobs/board-light-rows'
import {
  isEmptyQuery,
  isSearchActive,
  matchPlace,
  termsMask,
  METROS,
  metroLabel,
  normalizeSearchText,
  parseLocationQuery,
  parseSearchQuery,
  workArrangementOf,
  type BoardSearchParams,
  type LocationQuery,
  type ParsedQuery,
  type PlaceDoc,
} from '@/lib/jobs/board-search'

// The board search's per-job index (see board-search.ts for the semantics).
//
// The shared board's light rows (board-light-rows.ts) carry title, company and
// location, but not industry, O*NET occupation, skills, work arrangement or the
// import's parsed city / states. Those come from one narrow read of the wide table
// (a few seconds on a cold instance), held per server instance and refreshed in
// the background (stale-while-revalidate). The board page starts that read in the
// background once its shortlist has loaded (warmSearchIndex), so by the time a
// member types a search the index is usually in; email paths never load it. A
// search never waits for it: until it is in, the search matches the light fields
// only (title, company, function, location text — boardSearchWith with no index)
// and the page says so. Jobs newer than the held copy are still searchable on
// their light fields.
//
// Memory: no object per job. The index is one id → position map plus small typed
// arrays pointing into tables of distinct, already-normalized values (22 industries,
// ~37k skill sets, ~8k cities…). Matching keeps no per-row state either: every
// distinct title / company / location is normalized once (memo maps), and a row is
// matched through a few map lookups.

const ARRANGEMENTS = [null, 'remote', 'hybrid', 'onsite'] as const

/** Per-job search facts, compact: position by id, then a table index per field (0 = none). */
export interface SearchIndex {
  pos: Map<string, number>
  industry: Uint16Array
  soc: Uint16Array
  skills: Uint32Array
  city: Uint16Array
  states: Uint16Array
  arrangement: Uint8Array
  /** Distinct values, normalized (normalizeSearchText); index 0 is the empty value. */
  /** Title and company as of the load (a row edited since reads its own, see boardSearchWith). */
  title: Uint32Array
  /** The title's length at load: a row whose length differs was edited since, and reads its own title. */
  titleLength: Uint16Array
  company: Uint32Array
  tables: {
    title: string[]
    /** Each title's inferred function, normalized; filled on first use (null until then). */
    titleFunction: (string | null)[]
    company: string[]
    industry: string[]
    soc: string[]
    skills: string[]
    city: string[]
    states: (readonly string[])[]
  }
  /** Companies on the board with live job counts, most jobs first. */
  companies: { name: string; norm: string; count: number }[]
  /** "City, ST" places with job counts, most jobs first. */
  cities: { label: string; norm: string; count: number }[]
  loadedMs: number
}

const FRESH_MS = 10 * 60_000
const STALE_MS = 60 * 60_000
let held: { at: number; index: Promise<SearchIndex>; value: SearchIndex } | null = null
let loading: Promise<SearchIndex> | null = null
/** How long a search waits for an index already loading before it takes the fast path. */
const SEARCH_WAIT_MS = 300

interface FactsRow {
  id: string
  title: string
  companyName: string
  industry: string | null
  socTitle: string | null
  workArrangement: string | null
  locationCity: string | null
  locationState: string | null
  states: string | null
  skills: string | null
}

// Strings Prisma hands back can be slices of the whole ~75 MB query response, and
// keeping one slice keeps all of it. Anything the index keeps from a row is copied.
const ownCopy = (s: string) => Buffer.from(s, 'utf8').toString('utf8')

/** A table of distinct values: index 0 is "none". */
function table<T>(empty: T, key: (raw: string) => T) {
  const values: T[] = [empty]
  const at = new Map<string, number>()
  return {
    values,
    of(raw: string | null): number {
      if (!raw) return 0
      let i = at.get(raw)
      if (i === undefined) {
        i = values.length
        values.push(key(raw))
        at.set(raw, i)
      }
      return i
    },
  }
}

/** Builds the index from fact rows — exported for tests. */
export function buildSearchIndex(rows: FactsRow[], loadedMs = 0): SearchIndex {
  const n = rows.length
  const norm = (v: string) => normalizeSearchText(v)
  const title = table(' ', norm)
  const company = table(' ', norm)
  const industry = table(' ', norm)
  const soc = table(' ', norm)
  const skills = table(' ', norm)
  const city = table(' ', norm)
  const states = table<readonly string[]>([], (v) => v.split(',').map((x) => ownCopy(x.trim().toUpperCase())).filter(Boolean))
  const index: SearchIndex = {
    pos: new Map(),
    industry: new Uint16Array(n),
    soc: new Uint16Array(n),
    title: new Uint32Array(n),
    titleLength: new Uint16Array(n),
    company: new Uint32Array(n),
    skills: new Uint32Array(n),
    city: new Uint16Array(n),
    states: new Uint16Array(n),
    arrangement: new Uint8Array(n),
    tables: {
      title: title.values,
      titleFunction: [],
      company: company.values,
      industry: industry.values,
      soc: soc.values,
      skills: skills.values,
      city: city.values,
      states: states.values,
    },
    companies: [],
    cities: [],
    loadedMs,
  }
  const companyCounts = new Map<string, { name: string; count: number }>()
  const cityCounts = new Map<string, number>()
  rows.forEach((r, i) => {
    index.pos.set(ownCopy(r.id), i)
    index.industry[i] = industry.of(r.industry)
    index.soc[i] = soc.of(r.socTitle)
    index.title[i] = title.of(r.title)
    index.titleLength[i] = Math.min(r.title.length, 65_535)
    index.company[i] = company.of(r.companyName)
    index.skills[i] = skills.of(r.skills)
    index.city[i] = city.of(r.locationCity)
    index.states[i] = states.of(r.states ?? r.locationState)
    index.arrangement[i] = Math.max(0, ARRANGEMENTS.indexOf((r.workArrangement?.toLowerCase() ?? null) as (typeof ARRANGEMENTS)[number]))
    const co = normalizeSearchText(r.companyName).trim()
    if (co) {
      const c = companyCounts.get(co)
      if (c) c.count++
      else companyCounts.set(co, { name: ownCopy(r.companyName), count: 1 })
    }
    if (r.locationCity && r.locationState && !/[|\d]| - /.test(r.locationCity)) {
      const label = ownCopy(`${r.locationCity}, ${r.locationState.toUpperCase()}`)
      cityCounts.set(label, (cityCounts.get(label) ?? 0) + 1)
    }
  })
  index.tables.titleFunction = new Array(index.tables.title.length).fill(null)
  index.companies = [...companyCounts.entries()].map(([norm, c]) => ({ name: c.name, norm, count: c.count })).sort((a, b) => b.count - a.count)
  // One entry per place whatever its spelling ("NEW YORK, NY" / "New York, NY"),
  // labelled with its most common one; places with only a couple of jobs are left out.
  const places = new Map<string, { label: string; top: number; norm: string; count: number }>()
  for (const [label, count] of cityCounts) {
    const norm = normalizeSearchText(label.split(',')[0]).trim()
    const key = `${norm}|${label.slice(label.lastIndexOf(',') + 1).trim()}`
    const p = places.get(key)
    if (!p) places.set(key, { label, top: count, norm, count })
    else {
      p.count += count
      if (count > p.top) Object.assign(p, { label, top: count })
    }
  }
  index.cities = [...places.values()]
    .filter((p) => p.count >= 3)
    .map(({ label, norm, count }) => ({ label, norm, count }))
    .sort((a, b) => b.count - a.count)
  return index
}

async function readIndex(): Promise<SearchIndex> {
  const started = Date.now()
  const rows = await prisma.$queryRaw<FactsRow[]>`
    SELECT "id", "title", "companyName", "industry", "socTitle", "workArrangement", "locationCity", "locationState",
      NULLIF(array_to_string("locationStates", ','), '') AS "states", NULLIF(array_to_string("skills", ' '), '') AS "skills"
    FROM "ExclusiveJobPosting"
    WHERE "status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND "distribution" <> 'EXCLUDED'
      AND ("expiresAt" IS NULL OR "expiresAt" > now())`
  return buildSearchIndex(rows, Date.now() - started)
}

let read: () => Promise<SearchIndex> = readIndex

/** The held index; a cold instance waits for the first load, later callers never do. */
export function loadSearchIndex(): Promise<SearchIndex> {
  const now = Date.now()
  if (held && now - held.at < FRESH_MS) return held.index
  if (!loading) {
    const started = now
    const next = read()
    loading = next
    next.then(
      (value) => {
        held = { at: started, index: next, value }
        loading = null
      },
      (error) => {
        console.error('Board search index: load failed', error)
        loading = null
      }
    )
  }
  if (held && now - held.at < STALE_MS) return held.index
  return loading
}

/** Starts (or refreshes) the index load in the background; resolves once it is in, never rejects. */
export function warmSearchIndex(): Promise<void> {
  return loadSearchIndex().then(
    () => undefined,
    () => undefined
  )
}

/**
 * The index this instance holds (any age; past FRESH_MS a reload starts in the
 * background), else null. Never waits. With nothing held, `startCold` starts the
 * first load; a board render leaves that to its own warm-up after the board's read,
 * since on a cold instance the two big reads at once compete for the connection
 * pool and both get slower.
 */
export function peekSearchIndex({ startCold = true }: { startCold?: boolean } = {}): SearchIndex | null {
  if (held ? Date.now() - held.at >= FRESH_MS : startCold) void warmSearchIndex()
  return held?.value ?? null
}

/**
 * The import's stored place facts for one live job — every US state it lists
 * (locationStates, else locationState) and its work arrangement — from the held
 * index, without starting a load. null when the index isn't in or doesn't have the job.
 */
export function storedPlaceFacts(id: string): { states: readonly string[]; arrangement: 'remote' | 'hybrid' | 'onsite' | null } | null {
  const index = held?.value
  const j = index?.pos.get(id)
  if (!index || j === undefined) return null
  return { states: index.tables.states[index.states[j]] ?? [], arrangement: ARRANGEMENTS[index.arrangement[j]] ?? null }
}

/** The index now, or within `waitMs` while one is loading; else null (the caller takes the fast path). */
export async function searchIndexWithin(waitMs: number, opts?: { startCold?: boolean }): Promise<SearchIndex | null> {
  const now = peekSearchIndex(opts)
  if (now || waitMs <= 0 || !loading) return now
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs)
  })
  try {
    return await Promise.race([loading.catch(() => null), late])
  } finally {
    clearTimeout(timer)
  }
}

/** Tests only: swap the database read and forget the held index. */
export function resetSearchIndexForTests(reader?: () => Promise<SearchIndex>): void {
  read = reader ?? readIndex
  held = null
  loading = null
}

// ── Matching a row ──────────────────────────────────────────────────────────

type DocRow = Pick<LightRow, 'id' | 'title' | 'companyName' | 'location' | 'targetFunction' | 'targetRemotePolicy'>

// Distinct value → normalized form, shared by every search on this instance. Bounded:
// cleared when it grows past what the board can hold (~250k titles at most).
const MEMO_MAX = 400_000
function memo<V>(compute: (k: string) => V) {
  const m = new Map<string, V>()
  return (k: string): V => {
    let v = m.get(k)
    if (v === undefined) {
      if (m.size >= MEMO_MAX) m.clear()
      v = compute(k)
      m.set(k, v)
    }
    return v
  }
}
const normOf = memo(normalizeSearchText)
const functionOf = memo((title) => normalizeSearchText(inferFunctionFromTitle(title)))
const placeOf = memo((location) => ({ states: statesFromLocation(location).states as readonly string[], text: normalizeSearchText(location) }))
const NO_PLACE = { states: [] as readonly string[], text: ' ' }

export interface BoardSearch {
  parsed: ParsedQuery
  location: LocationQuery | null
  /** Relevance tier per row (0 best), null to drop it. */
  relevance: (row: DocRow) => number | null
  /** Same matcher for jobs that aren't board rows (partner-search jobs): title, company, location only. */
  matchesPlain: (job: { title: string; companyName: string | null; location: string | null }) => number | null
  /** False while this instance's index is still loading: matched on title, company, function and location text only. */
  indexReady: boolean
}

/**
 * The search for rankBoardRows' relevance option; null when no search is entered.
 * Never waits on a cold index (beyond a moment when one is already loading): it
 * matches the light fields instead while the load carries on in the background.
 */
export async function buildBoardSearch(params: BoardSearchParams, waitMs = SEARCH_WAIT_MS): Promise<BoardSearch | null> {
  if (!isSearchActive(params)) return null
  // A cold instance's first load is started by the board page once its shortlist is in (warmSearchIndex).
  return boardSearchWith(params, await searchIndexWithin(waitMs, { startCold: false }))
}

/** buildBoardSearch with the index given — exported for tests and the perf script. */
export function boardSearchWith(params: BoardSearchParams, index: SearchIndex | null): BoardSearch {
  const parsed = parseSearchQuery(params.q)
  const location = parseLocationQuery(params.loc)
  // A location nobody can read matches nothing rather than everything.
  const unreadable = params.loc !== '' && location === null
  const hasPlaceFilter = location !== null || params.remote !== null
  const t = index?.tables

  const noText = isEmptyQuery(parsed)
  const terms = parsed.terms
  const all = (1 << terms.length) - 1
  // Per search: which words each distinct value holds (tables from the index; maps filled as rows come).
  const tableBits = (values: readonly string[]) => Uint32Array.from(values, (v) => termsMask(v, terms))
  const socBits = t && terms.length > 0 ? tableBits(t.soc) : new Uint32Array(0)
  const skillsBits = t && terms.length > 0 ? tableBits(t.skills) : new Uint32Array(0)
  const industryBits = t && terms.length > 0 ? tableBits(t.industry) : new Uint32Array(0)
  const titleBits = t && terms.length > 0 ? new Int32Array(t.title.length).fill(-1) : new Int32Array(0)
  const fnBits = new Map<string, number>()
  const companyBits = new Map<string, number>()
  const bitsOf = (m: Map<string, number>, hay: string) => {
    let b = m.get(hay)
    if (b === undefined) {
      b = termsMask(hay, terms)
      m.set(hay, b)
    }
    return b
  }
  const relevance = (row: DocRow): number | null => {
    if (unreadable) return null
    if (hasPlaceFilter) {
      const lp = row.location ? placeOf(row.location) : NO_PLACE
      const j = posOf(row)
      const factStates = j >= 0 ? t!.states[index!.states[j]] : undefined
      const cityNorm = j >= 0 ? t!.city[index!.city[j]] : ' '
      const place: PlaceDoc = {
        states: factStates && factStates.length > 0 ? factStates : lp.states,
        // The import's city counts as part of the location text.
        text: cityNorm === ' ' ? lp.text : `${lp.text}${cityNorm.slice(1)}`,
        arrangement: workArrangementOf(j >= 0 ? ARRANGEMENTS[index!.arrangement[j]] : null, row.location, row.targetRemotePolicy),
      }
      if (!matchPlace(place, location, params.remote)) return null
    }
    if (noText) return 0
    // The index's normalized title / company when it has this job (and the title
    // hasn't been edited since it loaded), else normalized now (memoised).
    const j = posOf(row)
    const ti = j >= 0 ? index!.title[j] : 0
    const fresh = ti > 0 && index!.titleLength[j] === Math.min(row.title.length, 65_535)
    const company = fresh ? t!.company[index!.company[j]] : normOf(row.companyName)
    for (const c of parsed.companyNeedles) if (!company.includes(c)) return null
    const title = fresh ? t!.title[ti] : normOf(row.title)
    for (const x of parsed.excludeNeedles) if (title.includes(x) || company.includes(x)) return null
    if (terms.length === 0) return 0
    // Same tiers as matchSearchDoc, from one bit per word: in the title, else the
    // role fields, else company / industry. Every field but the title takes its
    // bits from a per-search table, so a row costs a few includes and lookups.
    let inTitle: number
    if (fresh) {
      // Titles repeat across jobs: each distinct one is checked once per search.
      inTitle = titleBits[ti]
      if (inTitle < 0) inTitle = titleBits[ti] = termsMask(title, terms)
    } else inTitle = termsMask(title, terms)
    if (inTitle === all) return title.includes(parsed.phraseNeedle) ? 0 : 1
    const inRole =
      inTitle |
      bitsOf(fnBits, fresh ? (t!.titleFunction[ti] ??= functionOf(row.title)) : functionOf(row.title)) |
      (row.targetFunction ? bitsOf(fnBits, normOf(row.targetFunction)) : 0) |
      (j >= 0 ? socBits[index!.soc[j]] | skillsBits[index!.skills[j]] : 0)
    if (inRole === all) return 2
    const inAny = inRole | bitsOf(companyBits, company) | (j >= 0 ? industryBits[index!.industry[j]] : 0)
    return inAny === all ? 3 : null
  }
  const posOf = (row: DocRow) => (index ? (index.pos.get(row.id) ?? -1) : -1)
  return {
    parsed,
    location,
    relevance,
    matchesPlain: (job) =>
      relevance({ id: '', title: job.title, companyName: job.companyName ?? '', location: job.location, targetFunction: null, targetRemotePolicy: null }),
    indexReady: index !== null,
  }
}

// ── Typeahead ───────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  kind: 'remote' | 'metro' | 'state' | 'city' | 'company'
  label: string
  /** What goes in the box (loc) or is added to the query (company:"…"). */
  value: string
  count?: number
}

const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]

const startsWord = (hay: string, prefix: string) => hay.startsWith(prefix) || hay.includes(` ${prefix}`)

/** Up to `limit` location or company suggestions for what's typed so far. */
export function suggestFrom(index: SearchIndex | null, kind: 'location' | 'company', typed: string, limit = 8): SearchSuggestion[] {
  const p = normalizeSearchText(typed).trim()
  if (!p) return []
  if (kind === 'company') {
    if (!index) return []
    const out: SearchSuggestion[] = []
    for (const c of index.companies) {
      if (!startsWord(c.norm, p)) continue
      out.push({ kind: 'company', label: c.name, value: c.name, count: c.count })
      if (out.length >= limit) break
    }
    return out
  }
  const out: SearchSuggestion[] = []
  if ('remote'.startsWith(p)) out.push({ kind: 'remote', label: 'Remote', value: 'Remote' })
  for (const m of METROS) if (startsWord(normalizeSearchText(m.label).trim(), p)) out.push({ kind: 'metro', label: metroLabel(m.key), value: m.label })
  for (const [code, name] of STATES) {
    if (code.toLowerCase() === p || startsWord(name.toLowerCase(), p)) out.push({ kind: 'state', label: name, value: name })
  }
  if (index) {
    for (const c of index.cities) {
      if (out.length >= limit) break
      if (c.norm.startsWith(p)) out.push({ kind: 'city', label: c.label, value: c.label, count: c.count })
    }
  }
  return out.slice(0, limit)
}
