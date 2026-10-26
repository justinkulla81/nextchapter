// Pure rules for the salary and job-title pages: what gets a page, how a title becomes a slug and a display name.
// No I/O, so they are unit-tested (src/test/job-title-rules.test.ts).

/** Open listings a title needs before it gets a page. */
export const TITLE_MIN_JOBS = 40
/** Listings with a usable stated annual pay a title needs before its salary page shows numbers. */
export const TITLE_MIN_PAY = 25

/** Titles too broad to mean one job: a salary page for them would average unrelated roles. */
export const GENERIC_TITLES = new Set([
  'manager', 'senior manager', 'director', 'senior director', 'associate director', 'executive director', 'vice president', 'vp', 'senior vice president',
  'executive vice president', 'assistant vice president', 'associate vice president', 'president', 'specialist', 'senior specialist', 'analyst', 'senior analyst', 'associate',
  'senior associate', 'consultant', 'senior consultant', 'coordinator', 'assistant', 'engineer', 'senior engineer', 'staff engineer', 'principal engineer', 'officer',
  'lead', 'supervisor', 'head', 'partner', 'principal', 'executive', 'administrator', 'representative', 'advisor', 'senior advisor', 'team lead', 'developer', 'architect',
])

export function titleSlug(base: string): string {
  return base.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

const ACRONYMS = new Set(['it', 'hr', 'vp', 'ai', 'ml', 'qa', 'ux', 'ui', 'sql', 'sap', 'erp', 'crm', 'seo', 'sdr', 'bdr', 'cpa', 'cfo', 'ceo', 'cto', 'cio', 'coo', 'cmo', 'rn', 'lpn', 'api', 'devops', 'ehs', 'fp&a', 'pmo', 'sre', 'bi', 'etl', 'aws', 'gis', 'cad', 'hvac', 'ii', 'iii', 'iv'])
const SMALL = new Set(['of', 'and', 'the', 'for', 'to', 'in', 'a', 'an', 'on', 'at', 'or'])

/** "senior software engineer" -> "Senior Software Engineer"; acronyms stay capitalized. */
export function displayTitle(base: string): string {
  return base
    .split(' ')
    .map((w, i) => {
      if (ACRONYMS.has(w)) return w.toUpperCase()
      if (i > 0 && SMALL.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/** "$128,500" from a rounded annual figure. */
export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** Annualized pay from a stated amount, or null when it is not a usable figure (same bounds as the SQL in job-titles.ts). */
export function annualPay(min: number | null, max: number | null, period: string | null): number | null {
  if (!min) return null
  const hi = max ?? min
  if (hi < min || hi > min * 3) return null
  const mid = (min + hi) / 2
  if (period === 'year') return min >= 25_000 && min <= 1_500_000 ? mid : null
  if (period === 'hour') return min * 2080 >= 25_000 && min * 2080 <= 400_000 ? mid * 2080 : null
  return null
}

/** The title the salary pages group by: the same cuts as the BASE expression in job-titles.ts (a " - Team" or "| Remote" tail, then anything after a comma, bracket, colon or slash), spaces collapsed, lower-cased. */
export function baseTitle(title: string): string {
  return title
    .replace(/[\s]+[-–—|][\s]+[\s\S]*$/, '')
    .replace(/[\s]*[,(:/][\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface PayVsMarket {
  /** Where this listing's pay sits against the listings for the same title that state pay. null when the listing states no usable annual pay. */
  position: 'below' | 'within' | 'above' | null
  /** Percent above (positive) or below (negative) the median, rounded to a whole number. null with no listing pay. */
  vsMedianPct: number | null
}

/** Compares one listing's annualized pay with its title's lower quarter, median and upper quarter. */
export function comparePay(pay: number | null, p25: number, median: number, p75: number): PayVsMarket {
  if (pay == null) return { position: null, vsMedianPct: null }
  return { position: pay < p25 ? 'below' : pay > p75 ? 'above' : 'within', vsMedianPct: Math.round(((pay - median) / median) * 100) }
}
