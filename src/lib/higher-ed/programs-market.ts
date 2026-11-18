// Academic Affairs: a college's programs against the job market (owner, 2026-11-18). Pure: the college's majors and every
// college's degrees by field come from federal IPEDS completions (static files, scripts/rankings/build_major_supply.py); open
// jobs and pay come from the monthly rankings build's stored degree-field row. No database read here.
//
// "Above average" means a degree field with at least as many open jobs per 100 new graduates as all covered fields together.
// Fields our board barely covers (nursing, education, health professions, social work: fieldCovered) are "not measured", never
// "below average", and majors that lead to many kinds of work belong to no field.

import { collegeMajorsView, type CollegeMajorRow, type RawCollegeMajor } from '@/lib/rankings/college-majors'
import type { DegreeFieldFigure, DegreeFieldFigures } from '@/lib/rankings/degrees-specs'

/** [name, state, control, degrees, base-year degrees, {degree field: degrees}, 2021 Carnegie basic classification, admission rate %] (college-index.json). */
export type CollegeIndexRow = [string, string, string | null, number, number, Record<string, number>, (number | null)?, (number | null)?]

/** Selectivity bands from the admission rate (IPEDS fall 2023); null when the college reports none (open admission). */
export function selectivityBand(rate: number | null | undefined): { key: string; label: string } | null {
  if (rate == null) return null
  if (rate < 15) return { key: 'most', label: 'admitting under 15% of applicants' }
  if (rate < 35) return { key: 'very', label: 'admitting 15% to 35% of applicants' }
  if (rate < 60) return { key: 'more', label: 'admitting 35% to 60% of applicants' }
  return { key: 'open', label: 'admitting 60% or more of applicants' }
}

/** Peer groups from the 2021 Carnegie basic classification: R1 and R2 apart, the master's and baccalaureate sizes together. */
export function classificationGroup(code: number | null | undefined): { key: string; label: string } | null {
  if (code == null) return null
  if (code === 15) return { key: 'r1', label: 'R1 research universities (very high research)' }
  if (code === 16) return { key: 'r2', label: 'R2 research universities (high research)' }
  if (code === 17) return { key: 'dpu', label: 'doctoral and professional universities' }
  if (code >= 18 && code <= 20) return { key: 'masters', label: "master's colleges and universities" }
  if (code >= 21 && code <= 23) return { key: 'bacc', label: 'baccalaureate colleges' }
  if (code >= 24 && code <= 33) return { key: 'special', label: 'special-focus institutions' }
  if (code >= 1 && code <= 14) return { key: 'assoc', label: 'associate and baccalaureate/associate colleges' }
  return null
}
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
  /** Open jobs in the state and per 100 of the state's graduates; null when not measured. Read against the state's own all-fields figure (stateAllPerHundred), never the national one: a national count also holds remote roles and postings with no state. */
  stateOpen: number | null
  statePerHundred: number | null
  statePay: number | null
  covered: boolean
}

export interface PeerRow { unitid: string; name: string; state: string; control: string | null; admitRate: number | null; total: number; change: number | null; aboveShare: number | null; topField: string | null; me: boolean }

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
  peers: { scope: string; chosen: boolean; rows: PeerRow[]; median: number | null }
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

/** Most peers shown, and most a college can choose. */
export const MAX_CHOSEN_PEERS = 20

/**
 * The colleges a college is compared with. Its own list when its team chose one (Institution.profile.peerUnitids). Otherwise
 * colleges of the same Carnegie classification group and selectivity band, public and private alike, closest in admission
 * rate and then size; without a band (no admission rate), the same classification and control at a half to double the size.
 * With fewer than 3 such colleges, control and size alone, and the scope says so.
 */
export function peersOf(unitid: string, index: CollegeIndex, chosen: string[] = []): { scope: string; ids: string[]; chosen: boolean } {
  const me = index[unitid]
  if (!me) return { scope: '', ids: [], chosen: false }
  const own = [...new Set(chosen)].filter((id) => id !== unitid && index[id]).slice(0, MAX_CHOSEN_PEERS)
  if (own.length > 0) return { scope: 'chosen by your team', ids: own, chosen: true }
  const [, state, control, total] = me
  const group = classificationGroup(me[6])
  const band = selectivityBand(me[7])
  const rate = me[7]
  const others = Object.entries(index).filter(([id]) => id !== unitid)
  const bySize = (a: [string, CollegeIndexRow], b: [string, CollegeIndexRow]) => Math.abs(a[1][3] - total) - Math.abs(b[1][3] - total) || a[0].localeCompare(b[0])
  if (group && band && rate != null) {
    const matched = others.filter(([, r]) => classificationGroup(r[6])?.key === group.key && selectivityBand(r[7])?.key === band.key)
    if (matched.length >= 3) {
      const ids = matched.sort((a, b) => Math.abs((a[1][7] ?? 0) - rate) - Math.abs((b[1][7] ?? 0) - rate) || bySize(a, b)).slice(0, MAX_PEERS).map(([id]) => id)
      return { scope: `${group.label} ${band.label}, public and private, closest in admission rate`, ids, chosen: false }
    }
  }
  const lo = Math.floor(total / 2)
  const hi = total * 2
  const pool = others.filter(([, r]) => r[2] === control && r[3] >= lo && r[3] <= hi)
  const near = (rows: typeof pool) => [...rows].sort(bySize).slice(0, MAX_PEERS).map(([id]) => id)
  const range = `${lo.toLocaleString('en-US')} to ${hi.toLocaleString('en-US')} degrees a year`
  const kind = (control ?? 'Other').toLowerCase()
  const classed = group ? pool.filter(([, r]) => classificationGroup(r[6])?.key === group.key) : []
  if (group && classed.length >= 3) {
    const inState = classed.filter(([, r]) => r[1] === state)
    if (inState.length >= MIN_PEERS) return { scope: `${kind} ${group.label} in ${state} awarding ${range}`, ids: near(inState), chosen: false }
    return { scope: `${kind} ${group.label} nationwide awarding ${range}`, ids: near(classed), chosen: false }
  }
  const inState = pool.filter(([, r]) => r[1] === state)
  const note = group ? ` (fewer than 3 ${group.label} of this size, so not matched on classification)` : ''
  if (inState.length >= MIN_PEERS) return { scope: `${kind} colleges in ${state} awarding ${range}${note}`, ids: near(inState), chosen: false }
  return { scope: `${kind} colleges nationwide awarding ${range}${note}`, ids: near(pool), chosen: false }
}

export function programsMarket(input: {
  unitid: string
  raw: RawCollegeMajor[]
  index: CollegeIndex
  figures: DegreeFieldFigures | null
  previous: DegreeFieldFigures | null
  /** The peers the college's team chose, if any (Institution.profile.peerUnitids). */
  chosenPeers?: string[]
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
      statePay: jobs?.[1] ?? null,
      covered,
    }
  }).sort((a, b) => b.here - a.here || b.stateGrads - a.stateGrads)
  const measured = stateFields.filter((s) => s.covered && s.stateOpen != null)
  const sGrads = measured.reduce((s, x) => s + x.stateGrads, 0)
  const stateAllPerHundred = figures?.states?.[state] && sGrads > 0 ? Math.round((measured.reduce((s, x) => s + (x.stateOpen ?? 0), 0) / sGrads) * 1000) / 10 : null

  const peerSet = peersOf(unitid, index, input.chosenPeers)
  const peerRow = (id: string, isMe: boolean): PeerRow => {
    const r = index[id]
    const m = mixOf(r[5], r[3], figures, allFields)
    const top = Object.entries(r[5]).sort((a, b) => b[1] - a[1])[0]
    return { unitid: id, name: r[0], state: r[1], control: r[2], admitRate: r[7] ?? null, total: r[3], change: r[4] >= 50 ? ((r[3] - r[4]) / r[4]) * 100 : null, aboveShare: aboveShareOf(m), topField: top?.[0] ?? null, me: isMe }
  }
  const peerRows = peerSet.ids.map((id) => peerRow(id, false))
  const shares = peerRows.map((p) => p.aboveShare).filter((x): x is number => x != null)

  return {
    name, state, edition: figures?.edition ?? null, previousEdition: previous?.edition ?? null,
    total, change: total0 >= 50 ? ((total - total0) / total0) * 100 : null,
    mix, aboveShare: figures ? aboveShareOf(mix) : null, allFieldsPerHundred: allFields,
    rows, stateFields, stateAllPerHundred,
    peers: { scope: peerSet.scope, chosen: peerSet.chosen, rows: [peerRow(unitid, true), ...peerRows].sort((a, b) => (b.aboveShare ?? -1) - (a.aboveShare ?? -1)), median: figures ? median(shares) : null },
  }
}
