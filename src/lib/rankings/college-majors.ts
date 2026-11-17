// A college's majors (federal IPEDS completions, scripts/rankings/build_major_supply.py) beside the job market of the degree
// field each leads to (the monthly rankings build's stored row), for the majors section of the college pages. One small
// static file per state: no database read. Degrees at bachelor's level and above only, so two-year colleges have none.

import { MAJORS, majorChange, type Major } from '@/lib/rankings/majors'
import type { DegreeFieldFigure, DegreeFieldFigures } from '@/lib/rankings/degrees-specs'

/** [CIP series, bachelor's, master's, doctoral], most degrees first. */
export type RawCollegeMajor = [string, number, number, number]

export interface CollegeMajorRow {
  major: Major
  /** Degrees here a year at bachelor's level and above, and by level. */
  total: number
  bach: number
  master: number
  doctoral: number
  /** This college's share of all US degrees in the major. */
  shareOfUs: number
  /** Three-year change in US degrees in the major, or null when too small to read. */
  usChange: number | null
  /** The degree field's national figures, or null when the major leads to many kinds of work or before the first build. */
  field: DegreeFieldFigure | null
}

export interface CollegeMajorsView {
  rows: CollegeMajorRow[]
  /** Open jobs per 100 graduates across every field with graduates, the line each field is read against. */
  allFields: number | null
  edition: string | null
}

const BY_CIP = new Map(MAJORS.map((m) => [m.cip, m]))

export function collegeMajorsView(raw: RawCollegeMajor[], figures: DegreeFieldFigures | null): CollegeMajorsView {
  const byField = new Map((figures?.fields ?? []).map((f) => [f.field, f]))
  const rows = raw.flatMap(([cip, bach, master, doctoral]): CollegeMajorRow[] => {
    const major = BY_CIP.get(cip)
    const total = bach + master + doctoral
    if (!major || total <= 0) return []
    return [{
      major, total, bach, master, doctoral, shareOfUs: major.total > 0 ? total / major.total : 0, usChange: majorChange(major),
      field: major.field ? byField.get(major.field) ?? null : null,
    }]
  })
  const withGrads = (figures?.fields ?? []).filter((f) => f.grads > 0)
  const grads = withGrads.reduce((s, f) => s + f.grads, 0)
  return {
    rows: rows.sort((a, b) => b.total - a.total),
    allFields: grads > 0 ? Math.round((withGrads.reduce((s, f) => s + f.open, 0) / grads) * 1000) / 10 : null,
    edition: figures?.edition ?? null,
  }
}

/** The college's majors, most degrees first; empty for a college with no degrees at bachelor's level and above. */
export async function loadCollegeMajors(state: string, unitid: string): Promise<RawCollegeMajor[]> {
  if (!/^[A-Z]{2}$/.test(state)) return []
  try {
    const file = (await import(`@/lib/rankings/data/college-majors/${state}.json`)).default as Record<string, RawCollegeMajor[]>
    return file[unitid] ?? []
  } catch {
    return []
  }
}
