import { COUNTY_SECTORS, type CountyContextData } from './county-context'

/**
 * Compare places: a metro area measured the same way as the member's current
 * one, so every figure can be read as better or worse than staying. Pure and
 * client-safe; the database reads are in ./metro-compare-data.ts.
 *
 * A metro is its counties (Census CBSA delineation, 2023). Unemployment is
 * the BLS county figures added up, population and sector jobs come from the
 * bundled Census and QCEW data, and prices are BEA regional price parities
 * (the U.S. is 100). Built by scripts/workforce/build-metro-compare.py.
 */

export interface Rpp { all: number; goods: number | null; housing: number | null; utilities: number | null; other: number | null }
export interface Metro { cbsa: string; name: string; counties: string[]; rpp: Rpp }
export interface MetroFile { year: number; metros: { c: string; n: string; f: string[]; r: (number | null)[] }[] }

export function parseMetros(file: MetroFile): Metro[] {
  return file.metros.map((m) => ({
    cbsa: m.c,
    name: m.n,
    counties: m.f,
    rpp: { all: m.r[0] ?? 100, goods: m.r[1], housing: m.r[2], utilities: m.r[3], other: m.r[4] },
  }))
}

/** "Louisville/Jefferson County, KY-IN" → "Louisville/Jefferson County, KY-IN" shortened to the first city and state. */
export function shortMetroName(name: string): string {
  const [cities, states] = name.split(', ')
  const first = cities.split(/[-–]/)[0].replace(/\/.*$/, '').trim()
  return states ? `${first}, ${states.split('-')[0]}` : first
}

export function metroForCounty(metros: Metro[], fips: string | null | undefined): Metro | null {
  if (!fips) return null
  return metros.find((m) => m.counties.includes(fips)) ?? null
}

export function searchMetros(metros: Metro[], q: string, limit = 8): Metro[] {
  const needle = q.toLowerCase().trim()
  if (needle.length < 2) return []
  return metros.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, limit)
}

// ── Unemployment ─────────────────────────────────────────────────────────

export interface LaborRow { fips: string; laborForce: number | null; unemployed: number | null; rateYearAgo: number | null; period: string | null }
export interface Unemployment { rate: number; rateYearAgo: number | null; laborForce: number; period: string | null }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Unemployed over labor force across a metro's counties, so a big county weighs what it should. */
export function metroUnemployment(counties: string[], rows: Map<string, LaborRow>): Unemployment | null {
  let u = 0, lf = 0, ago = 0, agoLf = 0, period: string | null = null
  for (const f of counties) {
    const r = rows.get(f)
    if (!r || !r.laborForce || r.unemployed == null) continue
    u += r.unemployed
    lf += r.laborForce
    if (r.rateYearAgo != null) { ago += (r.rateYearAgo / 100) * r.laborForce; agoLf += r.laborForce }
    if (r.period && (!period || r.period > period)) period = r.period
  }
  if (lf <= 0) return null
  return { rate: round1((u / lf) * 100), rateYearAgo: agoLf > 0 ? round1((ago / agoLf) * 100) : null, laborForce: lf, period }
}

// ── Member's sector ──────────────────────────────────────────────────────

/**
 * The QCEW sectors a member's industry bucket works in (src/lib/constants/industry-buckets.ts).
 * Listed, not inferred. Government and nonprofit are not private-sector jobs, so
 * QCEW cannot speak for them: they are absent here and the page says so.
 */
const BUCKET_SECTORS: Record<string, string[]> = {
  'Venture Capital & Private Equity': ['52'],
  'Financial Services & Banking': ['52'],
  Insurance: ['52'],
  'Accounting & Audit': ['54'],
  'Legal Services': ['54'],
  'Professional Services & Consulting': ['54'],
  'Advertising, Marketing & PR': ['54'],
  'Technology & Software': ['51', '54'],
  Telecommunications: ['51'],
  'Media & Entertainment': ['51', '71'],
  'Healthcare & Hospital Systems': ['62'],
  'Pharmaceuticals & Biotech': ['31-33', '54'],
  'Medical Devices': ['31-33'],
  'Retail & E-commerce': ['44-45'],
  'Consumer Packaged Goods': ['31-33'],
  'Hospitality, Travel & Food Service': ['72'],
  'Agriculture & Food Production': ['11', '31-33'],
  'Manufacturing & Industrial': ['31-33'],
  'Automotive & Mobility': ['31-33'],
  'Aerospace & Defense': ['31-33'],
  'Energy & Utilities': ['21', '22'],
  'Construction & Real Estate': ['23', '53'],
  'Transportation & Logistics': ['48-49'],
  'Education & EdTech': ['61'],
  'Staffing & Human Capital': ['56'],
}

export function bucketSectors(bucket: string | null | undefined): string[] | null {
  return (bucket && BUCKET_SECTORS[bucket]) || null
}

export interface SectorTrend { labels: string[]; jobs: number; changePct: number | null }

/** Private-sector jobs in the given sectors across a metro's counties, 2022 → 2024; a county that suppresses a sector is left out of it, never counted as zero. */
export function sectorTrend(data: CountyContextData, counties: string[], codes: string[]): SectorTrend {
  let now = 0, then = 0
  for (const code of codes) {
    const i = data.sectors.indexOf(code)
    if (i < 0) continue
    for (const f of counties) {
      const row = data.counties[f]
      if (!row) continue
      const a = row.e[2 * i], b = row.e[2 * i + 1]
      if (a >= 0 && b >= 0) { then += a; now += b }
    }
  }
  return {
    labels: codes.map((c) => COUNTY_SECTORS.find((s) => s.code === c)?.label ?? c),
    jobs: now,
    changePct: then > 0 ? round1(((now - then) / then) * 100) : null,
  }
}

// ── Everything about one metro ───────────────────────────────────────────

export interface MetroFacts {
  cbsa: string
  name: string
  states: string[]
  unemployment: Unemployment | null
  populationChangePct: number | null
  /** Open roles on the NextChapter job board in the metro, and how many are in the member's field. */
  openRoles: number
  fieldRoles: number | null
  rolesPer10kWorkers: number | null
  fieldRolesPer10kWorkers: number | null
  sector: SectorTrend | null
  rpp: Rpp
}

export function factsFor(args: {
  metro: Metro
  states: string[]
  labor: Map<string, LaborRow>
  context: CountyContextData
  roles: Map<string, number>
  fieldRoles: Map<string, number> | null
  sectorCodes: string[] | null
}): MetroFacts {
  const { metro, labor, context, roles, fieldRoles, sectorCodes } = args
  const unemployment = metroUnemployment(metro.counties, labor)
  const rows = metro.counties.map((f) => context.counties[f]).filter(Boolean)
  const withPop = rows.filter((r) => r.p)
  const p20 = withPop.reduce((s, r) => s + r.p![0], 0)
  const p24 = withPop.reduce((s, r) => s + r.p![1], 0)
  const sum = (m: Map<string, number>) => metro.counties.reduce((s, f) => s + (m.get(f) ?? 0), 0)
  const openRoles = sum(roles)
  const field = fieldRoles ? sum(fieldRoles) : null
  const per10k = (n: number) => (unemployment && unemployment.laborForce > 0 ? round1((n / unemployment.laborForce) * 10_000) : null)
  return {
    cbsa: metro.cbsa,
    name: metro.name,
    states: args.states,
    unemployment,
    populationChangePct: p20 > 0 ? round1(((p24 - p20) / p20) * 100) : null,
    openRoles,
    fieldRoles: field,
    rolesPer10kWorkers: per10k(openRoles),
    fieldRolesPer10kWorkers: field == null ? null : per10k(field),
    sector: sectorCodes ? sectorTrend(context, metro.counties, sectorCodes) : null,
    rpp: metro.rpp,
  }
}

// ── Comparing to where you are ───────────────────────────────────────────

/** What a salary here buys there: the same pay in a place that costs 20% more is worth 20% less. */
export function realValue(salary: number, fromRpp: number, toRpp: number): number {
  return Math.round((salary * fromRpp) / toRpp)
}

/** How much more (+) or less (−) a place costs than another, in percent. */
export function costDifferencePct(fromRpp: number, toRpp: number): number {
  return Math.round(((toRpp - fromRpp) / fromRpp) * 100)
}

export type Verdict = 'better' | 'worse' | 'same'
export interface Row { key: string; label: string; value: string | null; unit?: string; versus: string | null; verdict: Verdict | null; note?: string }

const pct = (n: number | null, digits = 1) => (n == null ? null : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`)
const ratePts = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)} pts`

function judge(delta: number | null, tolerance: number, higherIsBetter: boolean): Verdict | null {
  if (delta == null) return null
  if (Math.abs(delta) <= tolerance) return 'same'
  return delta > 0 === higherIsBetter ? 'better' : 'worse'
}

/** Percent difference of a over b; null when b is nothing to compare to. */
const relative = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : ((a - b) / b) * 100)

export type Lens = 'job' | 'life'

/**
 * The rows for one place against the member's current one (null when the member's
 * city is not known: the rows then carry values and no comparison). Job-search
 * lens leads with work; life lens leads with cost and growth and drops the job rows.
 */
export function compareRows(dest: MetroFacts, cur: MetroFacts | null, opts: { salary?: number | null; fieldName?: string | null } = {}): Row[] {
  const rows: Row[] = []

  const du = dest.unemployment
  const cu = cur?.unemployment ?? null
  rows.push({
    key: 'unemployment',
    label: 'Unemployment rate',
    value: du ? `${du.rate.toFixed(1)}%` : null,
    versus: du && cu ? ratePts(du.rate - cu.rate) : null,
    verdict: du && cu ? judge(du.rate - cu.rate, 0.3, false) : null,
    note: du?.rateYearAgo != null ? `${du.rateYearAgo.toFixed(1)}% a year ago` : undefined,
  })

  const dr = dest.rolesPer10kWorkers
  const cr = cur?.rolesPer10kWorkers ?? null
  const roleDelta = relative(dr, cr)
  rows.push({
    key: 'roles',
    label: 'Open roles on our job board',
    value: dr == null ? null : String(dr),
    unit: 'per 10,000 workers',
    versus: roleDelta == null ? null : pct(roleDelta, 0),
    verdict: judge(roleDelta, 15, true),
    note: 'Roles on NextChapter only, so read it against your own city, not as the whole market.',
  })

  if (dest.fieldRolesPer10kWorkers != null) {
    const d = relative(dest.fieldRolesPer10kWorkers, cur?.fieldRolesPer10kWorkers ?? null)
    rows.push({
      key: 'field-roles',
      label: opts.fieldName ? `Open ${opts.fieldName} roles` : 'Open roles in your field',
      value: String(dest.fieldRolesPer10kWorkers),
      unit: 'per 10,000 workers',
      versus: d == null ? null : pct(d, 0),
      verdict: judge(d, 15, true),
    })
  }

  if (dest.sector) {
    const cs = cur?.sector?.changePct ?? null
    const ds = dest.sector.changePct
    rows.push({
      key: 'sector',
      label: `Jobs in ${dest.sector.labels.join(' and ').toLowerCase()}, 2022 to 2024`,
      value: pct(ds),
      versus: ds != null && cs != null ? ratePts(ds - cs) : null,
      verdict: ds != null && cs != null ? judge(ds - cs, 1, true) : null,
      note: 'Private-sector jobs only.',
    })
  }

  const dp = dest.populationChangePct
  const cp = cur?.populationChangePct ?? null
  rows.push({
    key: 'population',
    label: 'Population, 2020 to 2024',
    value: pct(dp),
    versus: dp != null && cp != null ? ratePts(dp - cp) : null,
    verdict: dp != null && cp != null ? judge(dp - cp, 1, true) : null,
  })

  const costDiff = cur ? costDifferencePct(cur.rpp.all, dest.rpp.all) : null
  rows.push({
    key: 'cost',
    label: 'Cost of living (U.S. = 100)',
    value: dest.rpp.all.toFixed(0),
    versus: costDiff == null ? null : `${costDiff > 0 ? '+' : costDiff < 0 ? '−' : ''}${Math.abs(costDiff)}%`,
    verdict: judge(costDiff, 2, false),
  })

  if (dest.rpp.housing != null) {
    const hd = cur?.rpp.housing != null ? costDifferencePct(cur.rpp.housing, dest.rpp.housing) : null
    rows.push({
      key: 'housing',
      label: 'Housing costs (U.S. = 100)',
      value: dest.rpp.housing.toFixed(0),
      versus: hd == null ? null : `${hd > 0 ? '+' : hd < 0 ? '−' : ''}${Math.abs(hd)}%`,
      verdict: judge(hd, 3, false),
    })
  }

  if (opts.salary && cur) {
    const worth = realValue(opts.salary, cur.rpp.all, dest.rpp.all)
    const diff = worth - opts.salary
    rows.push({
      key: 'real-pay',
      label: `$${opts.salary.toLocaleString('en-US')} of pay here buys`,
      value: `$${worth.toLocaleString('en-US')}`,
      versus: `${diff >= 0 ? '+' : '−'}$${Math.abs(diff).toLocaleString('en-US')}`,
      verdict: judge(diff, opts.salary * 0.02, true),
      note: 'What the same pay buys there. A job there that pays more than this beats staying.',
    })
  }
  return rows
}

// ── Which numbers lead ───────────────────────────────────────────────────

/** Rows shown first. Out of work: how fast a job comes. Working: what the pay buys. */
export function headlineKeys(employed: boolean): string[] {
  return employed ? ['real-pay', 'cost', 'sector'] : ['unemployment', 'field-roles', 'roles']
}

const EMPLOYED = new Set(['EMPLOYED_CONSIDERING_MOVE', 'SEEKING_PROMOTION'])
/** Employed members compare what pay buys; everyone else (including nobody who has said) compares how fast a job comes. */
export function isEmployedStatus(status: string | null | undefined): boolean {
  return !!status && EMPLOYED.has(status)
}

/** Rows for the life lens: the job rows are left out, cost and growth stay. */
export function forLens(rows: Row[], lens: Lens): Row[] {
  return lens === 'job' ? rows : rows.filter((r) => !['roles', 'field-roles', 'sector', 'unemployment'].includes(r.key))
}

/** A place in one plain sentence: how it stacks up on the rows that have a comparison. */
export function summarize(rows: Row[]): string {
  const judged = rows.filter((r) => r.verdict)
  const better = judged.filter((r) => r.verdict === 'better').length
  const worse = judged.filter((r) => r.verdict === 'worse').length
  if (judged.length === 0) return 'Add your city and state to see how this compares with where you are.'
  if (better === 0 && worse === 0) return 'About the same as where you are on everything measured.'
  return `Better than where you are on ${better} of ${judged.length} measures, worse on ${worse}.`
}

// ── What the page shows ──────────────────────────────────────────────────

export const MAX_PLACES = 3

export interface Incentives { state: string; count: number; names: string[] }
export interface PlaceView { cbsa: string; name: string; rows: Row[]; incentives: Incentives | null }

export function compareHref(cbsas: string[], lens: Lens): string {
  const params = new URLSearchParams()
  if (cbsas.length) params.set('m', cbsas.join(','))
  if (lens === 'life') params.set('lens', 'life')
  const q = params.toString()
  return `/dashboard/compare-places${q ? `?${q}` : ''}`
}

/** The ?m= value, made safe: five-digit codes of metros we know, no repeats, at most MAX_PLACES. */
export function parsePlaces(raw: string | null | undefined, metros: Metro[]): string[] {
  const known = new Set(metros.map((m) => m.cbsa))
  return [...new Set((raw ?? '').split(',').map((s) => s.trim()).filter((s) => /^\d{5}$/.test(s) && known.has(s)))].slice(0, MAX_PLACES)
}
