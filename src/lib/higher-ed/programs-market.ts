// Academic Affairs: a college's programs against the job market (owner, 2026-11-18). Pure: the college's majors and every
// college's degrees by field come from federal IPEDS completions (static files, scripts/rankings/build_major_supply.py); open
// jobs and pay come from the monthly rankings build's stored degree-field row. No database read here.
//
// "Above average" means a degree field with at least as many open jobs per 100 new graduates as all covered fields together.
// Fields our board barely covers (nursing, education, health professions, social work: fieldCovered) are "not measured", never
// "below average", and majors that lead to many kinds of work belong to no field.

import { collegeMajorsView, type CollegeMajorRow, type RawCollegeMajor } from '@/lib/rankings/college-majors'
import type { DegreeFieldFigure, DegreeFieldFigures } from '@/lib/rankings/degrees-specs'

/** [name, state, control, degrees, base-year degrees, {degree field: degrees}] (college-index.json). */
export type CollegeIndexRow = [string, string, string | null, number, number, Record<string, number>]
export type CollegeIndex = Record<string, CollegeIndexRow>

export type FieldStanding = 'above' | 'below' | 'unmeasured' | 'many'

export interface FieldMix { above: number; below: number; unmeasured: number; many: number }

export interface StateFieldRow {
  field: string
  /** This college's degrees a year in the field. */
  here: number
  /** Degrees a year in the field at every college in the state, and this college's share of them. */
  stateGrads: number
  shareOfState: number
  /** Open jobs in the state, per 100 of the state's graduates, and the national figure beside it; null when not measured. */
  stateOpen: number | null
  statePerHundred: number | null
  usPerHundred: number | null
  statePay: number | null
  covered: boolean
}

export interface PeerRow { unitid: string; name: string; state: string; total: number; change: number | null; aboveShare: number | null; topField: string | null; me: boolean }

export interface ProgramsMarket {
  name: string
  state: string
  edition: string | null
  previousEdition: string | null
  /** Bachelor's and above a year, and the change since the base year. */
  total: number
  change: number | null
  mix: FieldMix
  /** Share of degrees in above-average fields, among degrees in measured fields; null before the first build. */
  aboveShare: number | null
  allFieldsPerHundred: number | null
  rows: (CollegeMajorRow & { standing: FieldStanding; usOpenChange: number | null })[]
  stateFields: StateFieldRow[]
  stateAllPerHundred: number | null
  peers: { scope: string; rows: PeerRow[]; median: number | null }
}

const pct = (a: number, b: number) => (b > 0 ? a / b : 0)

export function standingOf(field: string | null, figures: DegreeFieldFigures | null, allFields: number | null): FieldStanding {
  if (!field) return 'many'
  const f = figures?.fields.find((x) => x.field === field)
  if (!f || f.covered === false || f.perHundred == null || allFields == null) return 'unmeasured'
  return f.perHundred >= allFields ? 'above' : 'below'
}

/** A college's degrees by standing, from its degrees by field and its total. */
export function mixOf(byField: Record<string, number>, total: number, figures: DegreeFieldFigures | null, allFields: number | null): FieldMix {
  const out: FieldMix = { above: 0, below: 0, unmeasured: 0, many: 0 }
  let inFields = 0
  for (const [field, n] of Object.entries(byField)) {
    out[standingOf(field, figures, allFields)] += n
    inFields += n
  }
  out.many += Math.max(0, total - inFields)
  return out
}

const aboveShareOf = (m: FieldMix) => (m.above + m.below > 0 ? m.above / (m.above + m.below) : null)

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const k = Math.floor(s.length / 2)
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2
}

const MIN_PEERS = 8
const MAX_PEERS = 12

/** Similar colleges: same control, a half to double the degrees a year, the same state first and the country if it has too few. */
export function peersOf(unitid: string, index: CollegeIndex): { scope: string; ids: string[] } {
  const me = index[unitid]
  if (!me) return { scope: '', ids: [] }
  const [, state, control, total] = me
  const lo = Math.floor(total / 2)
  const hi = total * 2
  const pool = Object.entries(index).filter(([id, r]) => id !== unitid && r[2] === control && r[3] >= lo && r[3] <= hi)
  const near = (rows: typeof pool) => rows.sort((a, b) => Math.abs(a[1][3] - total) - Math.abs(b[1][3] - total) || a[0].localeCompare(b[0])).slice(0, MAX_PEERS).map(([id]) => id)
  const inState = pool.filter(([, r]) => r[1] === state)
  const range = `${lo.toLocaleString('en-US')} to ${hi.toLocaleString('en-US')} degrees a year`
  const kind = (control ?? 'Other').toLowerCase()
  if (inState.length >= MIN_PEERS) return { scope: `${kind} colleges in ${state} awarding ${range}`, ids: near(inState) }
  return { scope: `${kind} colleges nationwide awarding ${range}`, ids: near(pool) }
}

export function programsMarket(input: {
  unitid: string
  raw: RawCollegeMajor[]
  index: CollegeIndex
  figures: DegreeFieldFigures | null
  previous: DegreeFieldFigures | null
}): ProgramsMarket | null {
  const { unitid, raw, index, figures, previous } = input
  const me = index[unitid]
  if (!me || raw.length === 0) return null
  const [name, state, , total, total0, byField] = me
  const view = collegeMajorsView(raw, figures)
  const allFields = view.allFields
  const prevOpen = new Map((previous?.fields ?? []).map((f) => [f.field, f.open]))
  const rows = view.rows.map((r) => {
    const f = r.field
    const before = f ? prevOpen.get(f.field) : undefined
    return { ...r, standing: standingOf(r.major.field, figures, allFields), usOpenChange: f && f.covered !== false && before ? ((f.open - before) / before) * 100 : null }
  })
  const mix = mixOf(byField, total, figures, allFields)

  // The state: every college's degrees by field, against the state's open jobs by field.
  const stateGrads: Record<string, number> = {}
  for (const r of Object.values(index)) {
    if (r[1] !== state) continue
    for (const [field, n] of Object.entries(r[5])) stateGrads[field] = (stateGrads[field] ?? 0) + n
  }
  const stateJobs = figures?.states?.[state] ?? {}
  const byFieldFig = new Map((figures?.fields ?? []).map((f) => [f.field, f]))
  const stateFields: StateFieldRow[] = Object.keys(stateGrads).map((field) => {
    const f: DegreeFieldFigure | undefined = byFieldFig.get(field)
    const covered = !!f && f.covered !== false
    const jobs = covered ? stateJobs[field] : undefined
    const grads = stateGrads[field]
    return {
      field, here: byField[field] ?? 0, stateGrads: grads, shareOfState: pct(byField[field] ?? 0, grads),
      stateOpen: covered ? jobs?.[0] ?? 0 : null,
      statePerHundred: covered && grads >= 100 ? Math.round(((jobs?.[0] ?? 0) / grads) * 1000) / 10 : null,
      usPerHundred: covered ? f?.perHundred ?? null : null,
      statePay: jobs?.[1] ?? null,
      covered,
    }
  }).sort((a, b) => b.here - a.here || b.stateGrads - a.stateGrads)
  const measured = stateFields.filter((s) => s.covered && s.stateOpen != null)
  const sGrads = measured.reduce((s, x) => s + x.stateGrads, 0)
  const stateAllPerHundred = figures?.states?.[state] && sGrads > 0 ? Math.round((measured.reduce((s, x) => s + (x.stateOpen ?? 0), 0) / sGrads) * 1000) / 10 : null

  const peerSet = peersOf(unitid, index)
  const peerRow = (id: string, isMe: boolean): PeerRow => {
    const r = index[id]
    const m = mixOf(r[5], r[3], figures, allFields)
    const top = Object.entries(r[5]).sort((a, b) => b[1] - a[1])[0]
    return { unitid: id, name: r[0], state: r[1], total: r[3], change: r[4] >= 50 ? ((r[3] - r[4]) / r[4]) * 100 : null, aboveShare: aboveShareOf(m), topField: top?.[0] ?? null, me: isMe }
  }
  const peerRows = peerSet.ids.map((id) => peerRow(id, false))
  const shares = peerRows.map((p) => p.aboveShare).filter((x): x is number => x != null)

  return {
    name, state, edition: figures?.edition ?? null, previousEdition: previous?.edition ?? null,
    total, change: total0 >= 50 ? ((total - total0) / total0) * 100 : null,
    mix, aboveShare: figures ? aboveShareOf(mix) : null, allFieldsPerHundred: allFields,
    rows, stateFields, stateAllPerHundred,
    peers: { scope: peerSet.scope, rows: [peerRow(unitid, true), ...peerRows].sort((a, b) => (b.aboveShare ?? -1) - (a.aboveShare ?? -1)), median: figures ? median(shares) : null },
  }
}
