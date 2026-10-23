/**
 * A board's local economy from bundled public data (built by
 * scripts/workforce/build-county-context.ts): county population from the
 * Census Bureau (2020 → 2024) and private-sector employment by NAICS sector
 * from BLS QCEW (2022 → 2024). Sums a board's counties; a sector a county
 * suppresses for confidentiality is left out of that county, never counted as
 * zero.
 */
export const COUNTY_SECTORS = [
  { code: '11', label: 'Agriculture' }, { code: '21', label: 'Mining & energy' }, { code: '22', label: 'Utilities' },
  { code: '23', label: 'Construction' }, { code: '31-33', label: 'Manufacturing' }, { code: '42', label: 'Wholesale' },
  { code: '44-45', label: 'Retail' }, { code: '48-49', label: 'Transportation & warehousing' }, { code: '51', label: 'Information' },
  { code: '52', label: 'Finance & insurance' }, { code: '53', label: 'Real estate' }, { code: '54', label: 'Professional & technical' },
  { code: '55', label: 'Management of companies' }, { code: '56', label: 'Admin & staffing' }, { code: '61', label: 'Private education' },
  { code: '62', label: 'Health care' }, { code: '71', label: 'Arts & recreation' }, { code: '72', label: 'Hotels & food' },
  { code: '81', label: 'Other services' },
] as const

/**
 * Sectors where most of the work is information handling AI can already do
 * in part: Information, Finance, Professional and technical, Management of
 * companies (the white-collar sectors in ./sector.ts) plus Admin and
 * staffing, where call centers and back-office work sit. Listed, not inferred.
 */
export const AI_EXPOSED_SECTORS: ReadonlySet<string> = new Set(['51', '52', '54', '55', '56'])

export interface CountyContextData {
  sectors: string[]
  counties: Record<string, { p?: [number, number]; t?: [number, number]; e: number[] }>
}

export interface SectorChange { code: string; label: string; share: number | null; jobs: number; change: number; changePct: number }
export interface AreaContext {
  population: { now: number; changePct: number } | null
  /** Share of private-sector jobs in AI-exposed sectors, and the biggest of them. */
  exposed: { share: number; top: { label: string; share: number }[] } | null
  /** Sectors that lost the most jobs 2022 → 2024 (a real loss: 2%+ and 300+ jobs). */
  shrinking: SectorChange[]
  /** Sectors that added the most jobs (3%+ and 300+ jobs). */
  growing: SectorChange[]
}

const MIN_JOBS = 300

export function areaContext(data: CountyContextData, fips: string[]): AreaContext {
  const rows = fips.map((f) => data.counties[f]).filter(Boolean)
  const withPop = rows.filter((r) => r.p)
  const p20 = withPop.reduce((s, r) => s + r.p![0], 0)
  const p24 = withPop.reduce((s, r) => s + r.p![1], 0)
  const population = p20 > 0 ? { now: p24, changePct: ((p24 - p20) / p20) * 100 } : null

  const withTotal = rows.filter((r) => r.t)
  const total24 = withTotal.reduce((s, r) => s + r.t![1], 0)
  const per = data.sectors.map((code, i) => {
    let now = 0, then = 0, nowAll = 0
    for (const r of rows) {
      const a = r.e[2 * i], b = r.e[2 * i + 1]
      if (b >= 0) nowAll += b
      if (a >= 0 && b >= 0) { then += a; now += b }
    }
    const label = COUNTY_SECTORS.find((s) => s.code === code)?.label ?? code
    return { code, label, now, then, nowAll, changePct: then > 0 ? ((now - then) / then) * 100 : 0, change: now - then }
  })
  const share = (jobs: number) => (total24 > 0 ? (jobs / total24) * 100 : null)
  const tag = (s: (typeof per)[number]): SectorChange => ({ code: s.code, label: s.label, share: share(s.nowAll), jobs: s.now, change: s.change, changePct: s.changePct })

  const exposedSectors = per.filter((s) => AI_EXPOSED_SECTORS.has(s.code) && s.nowAll > 0)
  const exposedJobs = exposedSectors.reduce((s, x) => s + x.nowAll, 0)
  const exposed = total24 > 0 && exposedSectors.length
    ? { share: (exposedJobs / total24) * 100, top: exposedSectors.sort((a, b) => b.nowAll - a.nowAll).slice(0, 2).map((s) => ({ label: s.label, share: share(s.nowAll)! })) }
    : null
  return {
    population,
    exposed,
    shrinking: per.filter((s) => s.changePct <= -2 && s.change <= -MIN_JOBS).sort((a, b) => a.change - b.change).slice(0, 2).map(tag),
    growing: per.filter((s) => s.changePct >= 3 && s.change >= MIN_JOBS).sort((a, b) => b.change - a.change).slice(0, 2).map(tag),
  }
}

/** Open roles by county: each (state, city) group of postings goes to the county its city sits in. */
export function jobsByCounty(
  groups: { st: string; city: string; n: number }[],
  placeCounty: Record<string, string>,
  keysFor: (city: string) => string[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of groups) {
    const fips = keysFor(g.city).map((k) => placeCounty[`${g.st}|${k}`]).find(Boolean)
    if (fips) out.set(fips, (out.get(fips) ?? 0) + g.n)
  }
  return out
}
