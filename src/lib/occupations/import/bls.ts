import { cell, numberOrNull, parseTable, resolveColumns } from './delimited'

// Parsers for BLS files, as CSV. BLS publishes both as Excel; export the sheet to CSV
// first (Excel "Save As CSV", or `libreoffice --headless --convert-to csv`).
//   OEWS national: bls.gov/oes/tables.htm, the "national" workbook (national_M<year>_dl.xlsx)
//   Employment Projections: bls.gov/emp/tables.htm, Table 1.2 (occupation.xlsx)

const SOC = /^\d{2}-\d{4}$/

export interface OewsRow {
  socCode: string
  employment: number | null
  wageP10: number | null
  wageP25: number | null
  wageMedian: number | null
  wageP75: number | null
  wageP90: number | null
  /** The median is reported only as a floor ("#"); wageMedian is then the floor if one was given, else null. */
  topCoded: boolean
}

/**
 * OEWS marks a wage at or above its published ceiling with "#" and withholds others with
 * "*" or "**". A "#" median is top-coded: the true figure is higher than the ceiling, so
 * a pay difference built on it would mislead. `topCodeAnnual` is that year's ceiling
 * (stated in the workbook's notes, not in its cells); without it a top-coded median is null.
 */
export function parseOewsNational(text: string, opts: { topCodeAnnual?: number } = {}): OewsRow[] {
  const t = parseTable(text, { headerStartsWith: /^OCC_CODE$/i })
  const c = resolveColumns(
    t,
    {
      occ: { match: ['OCC_CODE'] },
      group: { match: ['O_GROUP'], optional: true },
      industryGroup: { match: ['I_GROUP'], optional: true },
      ownership: { match: ['OWN_CODE'], optional: true },
      emp: { match: ['TOT_EMP'], optional: true },
      p10: { match: ['A_PCT10'] },
      p25: { match: ['A_PCT25'] },
      median: { match: ['A_MEDIAN'] },
      p75: { match: ['A_PCT75'] },
      p90: { match: ['A_PCT90'] },
    },
    'OEWS national'
  )
  const out = new Map<string, OewsRow>()
  for (const r of t.rows) {
    const socCode = cell(r, c.occ)
    if (!SOC.test(socCode)) continue
    if (c.group >= 0 && cell(r, c.group).toLowerCase() !== 'detailed') continue
    // The cross-industry, all-ownership row is the occupation's overall figure.
    if (c.industryGroup >= 0 && cell(r, c.industryGroup).toLowerCase() !== 'cross-industry') continue
    if (c.ownership >= 0 && cell(r, c.ownership) !== '1235') continue
    const wage = (idx: number) => {
      const v = cell(r, idx)
      return v === '#' ? (opts.topCodeAnnual ?? null) : numberOrNull(v)
    }
    out.set(socCode, {
      socCode,
      employment: numberOrNull(cell(r, c.emp)),
      wageP10: wage(c.p10),
      wageP25: wage(c.p25),
      wageMedian: wage(c.median),
      wageP75: wage(c.p75),
      wageP90: wage(c.p90),
      topCoded: cell(r, c.median) === '#',
    })
  }
  return [...out.values()]
}

export interface ProjectionRow {
  socCode: string
  baseYear: number
  projectedYear: number
  employmentBase: number | null
  employmentProj: number | null
  changePct: number | null
  annualOpenings: number | null
  typicalEducation: string | null
}

/**
 * Table 1.2 has the years in its headers ("Employment, 2024", "Employment, 2034"), and
 * employment and openings are in thousands. Both are scaled to people.
 */
export function parseProjections(text: string): ProjectionRow[] {
  const t = parseTable(text, { headerStartsWith: /^occupation code$/i })
  const years = t.header
    .map((h) => /^employment,?\s*(\d{4})$/i.exec(h)?.[1])
    .filter((y): y is string => !!y)
    .map(Number)
    .sort((a, b) => a - b)
  if (years.length < 2) throw new Error(`Projections: expected "Employment, <year>" columns for two years. Headers present: ${t.header.join(' | ')}`)
  const [baseYear, projectedYear] = [years[0], years[years.length - 1]]
  const c = resolveColumns(
    t,
    {
      code: { match: [/^occupation code$/i] },
      type: { match: [/^occupation type$/i], optional: true },
      base: { match: [new RegExp(`^employment,?\\s*${baseYear}$`, 'i')] },
      proj: { match: [new RegExp(`^employment,?\\s*${projectedYear}$`, 'i')] },
      pct: { match: [/employment percent change/i] },
      openings: { match: [/occupational openings/i] },
      education: { match: [/typical entry-level education/i], optional: true },
    },
    'Employment Projections'
  )
  const thousands = (v: string) => {
    const n = numberOrNull(v)
    return n === null ? null : Math.round(n * 1000)
  }
  const out = new Map<string, ProjectionRow>()
  for (const r of t.rows) {
    const socCode = cell(r, c.code)
    if (!SOC.test(socCode)) continue // summary and group rows
    if (c.type >= 0 && cell(r, c.type) && cell(r, c.type).toLowerCase() !== 'line item') continue
    out.set(socCode, {
      socCode,
      baseYear,
      projectedYear,
      employmentBase: thousands(cell(r, c.base)),
      employmentProj: thousands(cell(r, c.proj)),
      changePct: numberOrNull(cell(r, c.pct)),
      annualOpenings: thousands(cell(r, c.openings)),
      typicalEducation: cell(r, c.education) || null,
    })
  }
  return [...out.values()]
}
