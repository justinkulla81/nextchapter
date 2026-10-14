// Market pay rules for the company hiring index — pure functions, no I/O, tested in
// src/test/market-pay.test.ts. The SQL that builds benchmarks from these rules lives
// in src/lib/companies/hiring-index.ts; the thresholds are shared from here so the two
// can't drift.
//
// No model, no paid API: a benchmark is the spread of salaries employers actually
// posted for the same function and seniority (our own openings, most from
// pay-transparency states), adjusted for the state's pay level. An estimate is always
// labelled as the market's, never presented as what the employer posted.

/** Posted pay outside this (annualised, USD) is a data error, not a salary. */
export const MIN_ANNUAL_PAY = 20_000
export const MAX_ANNUAL_PAY = 2_000_000
/** A posted range wider than this (max / min) says nothing useful about the role. */
export const MAX_RANGE_SPREAD = 3
/** Hours in a full-time year, for hourly pay. */
export const HOURS_PER_YEAR = 2080

/** Within this share of the market median counts as in line. */
export const IN_LINE_BAND = 0.1
/** Minimum postings with pay before a company gets a pay level. */
export const MIN_EMPLOYER_PAY_SAMPLE = 3

/** Minimum posted salaries for each benchmark cell. */
export const MIN_NATIONAL_SAMPLE = 10
export const MIN_STATE_SAMPLE = 15
/** Cost-of-area index: minimum salaries in a state, and the shrink toward 1.0. */
export const MIN_AREA_SAMPLE = 30
export const AREA_SHRINK_K = 100
/** Benchmarks use salaries posted in this window. */
export const BENCHMARK_WINDOW_DAYS = 730

export interface AnnualPay {
  min: number
  max: number
  mid: number
}

/**
 * Posted pay as an annual USD range, or null when it can't be read as one.
 * Hourly (max under $300) is x2080; monthly (max $1,500–$25,000) is x12. A missing
 * currency on a US job is taken as USD; any other currency is dropped, since the
 * benchmarks are USD only.
 */
export function annualizePay(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): AnnualPay | null {
  if (currency && currency.trim() && currency.trim().toUpperCase() !== 'USD') return null
  let lo = typeof min === 'number' && min > 0 ? min : null
  let hi = typeof max === 'number' && max > 0 ? max : null
  if (lo === null && hi === null) return null
  if (lo === null) lo = hi
  if (hi === null) hi = lo
  if (lo! > hi!) [lo, hi] = [hi, lo]
  let factor = 1
  if (hi! < 300) factor = HOURS_PER_YEAR
  else if (hi! >= 1_500 && hi! <= 25_000) factor = 12
  const a = Math.round(lo! * factor)
  const b = Math.round(hi! * factor)
  if (a < MIN_ANNUAL_PAY || b > MAX_ANNUAL_PAY) return null
  if (b / a > MAX_RANGE_SPREAD) return null
  return { min: a, max: b, mid: Math.round((a + b) / 2) }
}

export type PayVsMarket = 'above' | 'in_line' | 'below'

/** Posted midpoint against the market median: within ±10% is in line. */
export function comparePay(postedMid: number, marketMid: number): { ratio: number; verdict: PayVsMarket } | null {
  if (!(postedMid > 0) || !(marketMid > 0)) return null
  const ratio = postedMid / marketMid
  const verdict: PayVsMarket = ratio > 1 + IN_LINE_BAND ? 'above' : ratio < 1 - IN_LINE_BAND ? 'below' : 'in_line'
  return { ratio, verdict }
}

export type EmployerPayLevel = 'high' | 'in_line' | 'low' | 'insufficient'

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * An employer's pay level from its jobs' posted-pay ratios to market: the median
 * ratio, high above +10%, low below -10%, and "insufficient" under 3 jobs.
 */
export function employerPayLevel(ratios: number[]): { level: EmployerPayLevel; sample: number; ratio: number | null } {
  const clean = ratios.filter((r) => Number.isFinite(r) && r > 0)
  if (clean.length < MIN_EMPLOYER_PAY_SAMPLE) return { level: 'insufficient', sample: clean.length, ratio: null }
  const r = median(clean)
  const level: EmployerPayLevel = r > 1 + IN_LINE_BAND ? 'high' : r < 1 - IN_LINE_BAND ? 'low' : 'in_line'
  return { level, sample: clean.length, ratio: r }
}

/** State cost-of-area index, shrunk toward 1.0 when the sample is small. */
export function shrinkIndex(raw: number, sample: number, k = AREA_SHRINK_K): number {
  if (!Number.isFinite(raw) || raw <= 0 || sample <= 0) return 1
  return 1 + (raw - 1) * (sample / (sample + k))
}

// ── Location → states ──────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC', 'puerto rico': 'PR',
}
const STATE_CODES = new Set(Object.values(STATE_NAMES))

// Big US cities that often appear with no state. "Washington" alone is the state;
// "Washington, DC" / "Washington DC" is handled by its code.
const CITY_STATE: Record<string, string> = {
  'new york city': 'NY', nyc: 'NY', manhattan: 'NY', brooklyn: 'NY', 'los angeles': 'CA', 'san francisco': 'CA',
  'bay area': 'CA', 'san jose': 'CA', 'san diego': 'CA', oakland: 'CA', 'palo alto': 'CA', 'mountain view': 'CA',
  sunnyvale: 'CA', 'santa clara': 'CA', 'menlo park': 'CA', 'redwood city': 'CA', irvine: 'CA', sacramento: 'CA',
  chicago: 'IL', houston: 'TX', dallas: 'TX', austin: 'TX', 'san antonio': 'TX', 'fort worth': 'TX',
  phoenix: 'AZ', scottsdale: 'AZ', philadelphia: 'PA', pittsburgh: 'PA', seattle: 'WA', bellevue: 'WA',
  redmond: 'WA', boston: 'MA', cambridge: 'MA', denver: 'CO', boulder: 'CO', atlanta: 'GA', miami: 'FL',
  tampa: 'FL', orlando: 'FL', jacksonville: 'FL', minneapolis: 'MN', detroit: 'MI', 'ann arbor': 'MI',
  nashville: 'TN', charlotte: 'NC', raleigh: 'NC', durham: 'NC', baltimore: 'MD', 'salt lake city': 'UT',
  'las vegas': 'NV', 'st. louis': 'MO', 'st louis': 'MO', 'kansas city': 'MO', columbus: 'OH', cleveland: 'OH',
  cincinnati: 'OH', indianapolis: 'IN', milwaukee: 'WI', 'new orleans': 'LA', stamford: 'CT', princeton: 'NJ',
  'washington dc': 'DC', 'washington d.c.': 'DC', arlington: 'VA', richmond: 'VA', honolulu: 'HI',
}

const REMOTE_RE = /\b(remote|anywhere|work from home|wfh|distributed|virtual)\b/i
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NAME_RE = new RegExp(`(^|[^a-z])(${Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length).map(escape).join('|')})(?![a-z])`, 'gi')
const CITY_RE = new RegExp(`(^|[^a-z])(${Object.keys(CITY_STATE).sort((a, b) => b.length - a.length).map(escape).join('|')})(?![a-z])`, 'gi')

/**
 * The US states a job location names, in order, plus whether it is remote.
 * Reads "City, ST", full state names and a short list of well-known cities; several
 * locations ("Austin, TX; Denver, CO") give several states.
 */
export function statesFromLocation(location: string | null | undefined): { states: string[]; isRemote: boolean } {
  if (!location || !location.trim()) return { states: [], isRemote: false }
  const text = location.trim()
  const isRemote = REMOTE_RE.test(text)
  const found: string[] = []
  const add = (code: string) => {
    if (!found.includes(code)) found.push(code)
  }
  // Two-letter codes standing as their own token after a separator: ", TX", "- TX",
  // "(TX)", "TX 78701", or a bare "TX".
  const codeRe = /(?:^|[,(/|;\-–]\s*|\s)([A-Z]{2})(?=\s*(?:$|[,)/|;\-–]|\s+\d{5}|\s+(?:US|USA|United States)\b))/g
  for (const m of text.matchAll(codeRe)) if (STATE_CODES.has(m[1])) add(m[1])
  const lower = text.toLowerCase()
  // "Washington, DC" names DC, not the state, so drop the state-name hit for it.
  const lowerNoDc = lower.replace(/washington,?\s*d\.?c\.?/g, ' ')
  for (const m of lowerNoDc.matchAll(NAME_RE)) add(STATE_NAMES[m[2].toLowerCase()])
  if (found.length === 0) for (const m of lower.matchAll(CITY_RE)) add(CITY_STATE[m[2].toLowerCase()])
  return { states: found, isRemote }
}

// ── Display ─────────────────────────────────────────────────────────────────

export const PAY_VS_MARKET_LABEL: Record<PayVsMarket, string> = {
  above: 'Above market',
  in_line: 'In line with market',
  below: 'Below market',
}

export const EMPLOYER_PAY_LEVEL_LABEL: Record<EmployerPayLevel, string> = {
  high: 'Pays above market',
  in_line: 'Pays in line with market',
  low: 'Pays below market',
  insufficient: 'Not enough posted pay to say',
}

/**
 * How a benchmark was matched, for a one-line source note. Stored as "kind:geo":
 * state (same function, level and state), national_adjusted (national for the
 * function and level, adjusted to the state), national, level_adjusted / level (every
 * function at this level — used when the function has too few salaries).
 */
export function marketBasisLabel(basis: string | null | undefined, sample: number | null | undefined): string | null {
  if (!basis) return null
  const [kind, geo] = basis.split(':')
  const n = sample ? `${sample.toLocaleString('en-US')} posted salaries` : 'posted salaries'
  switch (kind) {
    case 'state':
      return `Same function and level in ${geo} (${n})`
    case 'national_adjusted':
      return `Same function and level nationally, adjusted for ${geo} pay (${n})`
    case 'national':
      return `Same function and level nationally (${n})`
    case 'level_adjusted':
      return `All functions at this level nationally, adjusted for ${geo} pay (${n})`
    case 'level':
      return `All functions at this level nationally (${n})`
    default:
      return null
  }
}

export function formatUsdK(n: number): string {
  return `$${Math.round(n / 1000).toLocaleString('en-US')}k`
}
