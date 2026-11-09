import { LIGHT_SELECT, type LightRow } from '@/lib/jobs/board-light-rows'
import type { JobOccupations } from '@/lib/jobs/search-breadth-server'
import type { FactsRow } from '@/lib/jobs/board-search-index'

// The prepared board as plain JSON (board-snapshot.ts stores it between server
// instances). Pure: no I/O, so the round trip is unit-tested
// (src/test/board-snapshot.test.ts).
//
// Column by column (one JSON array per column, not one per row: a cold instance parses
// ~300k jobs, and per-row arrays were most of its garbage-collection time). Strings that
// repeat across jobs (company, location, level…) are written once per part in a table
// and referenced by index (-1 = null); ids and titles are written as they are. Dates are
// epoch milliseconds.

export const LIGHT_COLUMNS = Object.keys(LIGHT_SELECT) as (keyof LightRow)[]

const DATE_COLUMNS = new Set<keyof LightRow>(['postedAt', 'createdAt'])
const RAW_COLUMNS = new Set<keyof LightRow>(['id', 'title', 'sourceCount', 'salaryMin', 'salaryMax'])

/** One part of a shared board: its rows, and per row the expiry (ms, null = none) and the prior-closure count ghost risk read. */
export interface BoardPart {
  rows: LightRow[]
  expires: (number | null)[]
  priors: number[]
  /** Each title's function (infer-job-function.ts) as the writer worked it out; absent when not written. */
  titleFns?: (string | null)[]
}

interface EncodedBoardPart {
  v: 2
  cols: string[]
  strings: string[]
  /** One array per LIGHT_COLUMNS column. */
  data: unknown[][]
  expires: (number | null)[]
  priors: number[]
  /** String-table index of each title's function (-1 = none), or absent. */
  titleFns?: number[]
}

function stringTable() {
  const strings: string[] = []
  const index = new Map<string, number>()
  const ref = (s: string | null): number => {
    if (s === null) return -1
    let i = index.get(s)
    if (i === undefined) {
      i = strings.length
      strings.push(s)
      index.set(s, i)
    }
    return i
  }
  return { strings, ref }
}

export function encodeBoardPart(part: BoardPart): EncodedBoardPart {
  const { strings, ref } = stringTable()
  const data = LIGHT_COLUMNS.map((c) =>
    part.rows.map((r) => {
      const v = r[c] as unknown
      if (DATE_COLUMNS.has(c)) return v === null ? null : (v as Date).getTime()
      if (RAW_COLUMNS.has(c)) return v
      return ref(v as string | null)
    })
  )
  const titleFns = part.titleFns?.map(ref)
  return { v: 2, cols: LIGHT_COLUMNS as string[], strings, data, expires: part.expires, priors: part.priors, ...(titleFns ? { titleFns } : {}) }
}

// Row i from the columns, as a single object literal with every key in LIGHT_SELECT order
// (one hidden class for every row, as the database read gives them; ~4x faster than
// assigning key by key).
const rowAt = new Function(
  'd',
  's',
  'i',
  `return {${LIGHT_COLUMNS.map((c, k) =>
    DATE_COLUMNS.has(c)
      ? `${c}: d[${k}][i] === null ? null : new Date(d[${k}][i])`
      : RAW_COLUMNS.has(c)
        ? `${c}: d[${k}][i]`
        : `${c}: d[${k}][i] < 0 ? null : s[d[${k}][i]]`
  ).join(', ')}}`
) as (d: unknown[][], s: string[], i: number) => LightRow

/**
 * Rows exactly as the database read gives them (same keys in LIGHT_SELECT order, same
 * values, Dates for dates). `pool` interns repeated strings across parts. null when the
 * part was written for other columns (a different LIGHT_SELECT) or format: the caller
 * reads the database.
 */
export function decodeBoardPart(encoded: unknown, pool: Map<string, string> = new Map()): BoardPart | null {
  const e = encoded as EncodedBoardPart
  if (!e || e.v !== 2 || !Array.isArray(e.data) || JSON.stringify(e.cols) !== JSON.stringify(LIGHT_COLUMNS)) return null
  const strings = e.strings.map((s) => {
    const hit = pool.get(s)
    if (hit !== undefined) return hit
    pool.set(s, s)
    return s
  })
  const n = e.expires.length
  const rows: LightRow[] = new Array(n)
  for (let i = 0; i < n; i++) rows[i] = rowAt(e.data, strings, i)
  const titleFns = e.titleFns?.map((k) => (k < 0 ? null : strings[k]))
  return { rows, expires: e.expires, priors: e.priors, ...(titleFns ? { titleFns } : {}) }
}

interface EncodedOccupations {
  v: 2
  strings: string[]
  ids: string[]
  soc: number[]
  sub: number[]
  industry: number[]
  /** Every job's skills, end to end; skillsEnd[i] is where job i's end. */
  skills: number[]
  skillsEnd: number[]
  skillIds: number[]
  skillIdsEnd: number[]
}

/** The job-occupation maps (search-breadth-server.ts loadJobSocs) as JSON. */
export function encodeOccupations(o: JobOccupations): EncodedOccupations {
  const { strings, ref } = stringTable()
  // In id order, as the database read fills the maps, so each decoded map iterates in the same order.
  const ids = [...new Set([...o.socs.keys(), ...o.subs.keys(), ...o.industries.keys(), ...o.skills.keys(), ...o.skillIds.keys()])].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  const flat = (m: Map<string, readonly string[]>) => {
    const values: number[] = []
    const ends: number[] = []
    for (const id of ids) {
      for (const v of m.get(id) ?? []) values.push(ref(v))
      ends.push(values.length)
    }
    return [values, ends] as const
  }
  const [skills, skillsEnd] = flat(o.skills)
  const [skillIds, skillIdsEnd] = flat(o.skillIds)
  return {
    v: 2,
    strings,
    ids,
    soc: ids.map((id) => ref(o.socs.get(id) ?? null)),
    sub: ids.map((id) => ref(o.subs.get(id) ?? null)),
    industry: ids.map((id) => ref(o.industries.get(id) ?? null)),
    skills,
    skillsEnd,
    skillIds,
    skillIdsEnd,
  }
}

export function decodeOccupations(encoded: unknown): JobOccupations | null {
  const e = encoded as EncodedOccupations
  if (!e || e.v !== 2 || !Array.isArray(e.ids)) return null
  const s = e.strings
  const out: JobOccupations = { socs: new Map(), subs: new Map(), industries: new Map(), skills: new Map(), skillIds: new Map() }
  const unflat = (values: number[], ends: number[], into: Map<string, readonly string[]>) => {
    let start = 0
    for (let i = 0; i < ends.length; i++) {
      const end = ends[i]
      if (end > start) {
        const list = new Array<string>(end - start)
        for (let k = start; k < end; k++) list[k - start] = s[values[k]]
        into.set(e.ids[i], list)
      }
      start = end
    }
  }
  for (let i = 0; i < e.ids.length; i++) {
    const id = e.ids[i]
    if (e.soc[i] >= 0) out.socs.set(id, s[e.soc[i]])
    if (e.sub[i] >= 0) out.subs.set(id, s[e.sub[i]])
    if (e.industry[i] >= 0) out.industries.set(id, s[e.industry[i]])
  }
  unflat(e.skills, e.skillsEnd, out.skills)
  unflat(e.skillIds, e.skillIdsEnd, out.skillIds)
  return out
}

// The board search's raw facts (board-search-index.ts readIndex), one part per FACTS_PART_ROWS rows, column by column like the board,
// with every repeated string (company, industry, city, skills…) written once per part. Rows come back exactly as the database read gives them
// except that `postingType` is always present (null when the row had none), which the index treats the same.

export const FACTS_PART_ROWS = 100_000

interface EncodedFactsPart {
  v: 1
  strings: string[]
  ids: string[]
  title: number[]
  company: number[]
  industry: number[]
  soc: number[]
  arrangement: number[]
  city: number[]
  state: number[]
  states: number[]
  skills: number[]
  postingType: number[]
}

/** One part of the search facts as JSON. Call per slice of FACTS_PART_ROWS rows. */
export function encodeFactsPart(rows: readonly FactsRow[]): EncodedFactsPart {
  const { strings, ref } = stringTable()
  return {
    v: 1,
    strings,
    ids: rows.map((r) => r.id),
    title: rows.map((r) => ref(r.title)),
    company: rows.map((r) => ref(r.companyName)),
    industry: rows.map((r) => ref(r.industry)),
    soc: rows.map((r) => ref(r.socTitle)),
    arrangement: rows.map((r) => ref(r.workArrangement)),
    city: rows.map((r) => ref(r.locationCity)),
    state: rows.map((r) => ref(r.locationState)),
    states: rows.map((r) => ref(r.states)),
    skills: rows.map((r) => ref(r.skills)),
    postingType: rows.map((r) => ref(r.postingType ?? null)),
  }
}

/** Every part's rows, in order; null when any part is not in this format (the caller reads the database). */
export function decodeFacts(encodedParts: unknown[]): FactsRow[] | null {
  const out: FactsRow[] = []
  // One string per distinct value across parts, so a company named in every part is held once.
  const pool = new Map<string, string>()
  for (const encoded of encodedParts) {
    const e = encoded as EncodedFactsPart
    if (!e || e.v !== 1 || !Array.isArray(e.ids) || !Array.isArray(e.strings)) return null
    const s = e.strings.map((v) => {
      const hit = pool.get(v)
      if (hit !== undefined) return hit
      pool.set(v, v)
      return v
    })
    const at = (k: number): string | null => (k < 0 ? null : s[k])
    for (let i = 0; i < e.ids.length; i++) {
      out.push({
        id: e.ids[i],
        title: s[e.title[i]],
        companyName: s[e.company[i]],
        industry: at(e.industry[i]),
        socTitle: at(e.soc[i]),
        workArrangement: at(e.arrangement[i]),
        locationCity: at(e.city[i]),
        locationState: at(e.state[i]),
        states: at(e.states[i]),
        skills: at(e.skills[i]),
        postingType: at(e.postingType[i]),
      })
    }
  }
  return out
}
