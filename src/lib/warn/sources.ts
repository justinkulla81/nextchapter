import { readXlsx, excelSerialToDate } from './xlsx'
import { pdfText } from './pdf'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import {
  TABLE_SPECS,
  makeTableParser,
  GEOSOLINC_PORTALS,
  geosolincUrl,
  parseGeosolincList,
  parseGeosolincDetail,
  COLORADO_PAGE,
  resolveColoradoSheet,
  parseColoradoWarn,
  IOWA_PAGE,
  resolveIowaFile,
  parseIowaWarn,
  MISSISSIPPI_PAGE,
  resolveMississippiPdf,
  parseMississippiWarn,
  NEW_JERSEY_FILE,
  parseNewJerseyWarn,
  RHODE_ISLAND_PAGE,
  resolveRhodeIslandFile,
  parseRhodeIslandWarn,
  type GeosolincRow,
} from './states'

export interface WarnRow {
  state: string
  employer: string
  normalizedEmployer: string
  noticeDate: Date | null
  effectiveDate: Date | null
  employees: number | null
  layoffType: string | null
  county: string | null
  address: string | null
  industry: string | null
}

/**
 * NAICS sectors whose layoffs produce the people NextChapter serves.
 *
 * WARN covers every industry, so most notices are real layoffs and bad leads:
 * a food-plant closure and a software reduction are the same filing and
 * entirely different businesses for us. The sector prefix published alongside
 * each notice is the cheapest honest filter there is.
 */
const KNOWLEDGE_SECTORS = [
  '51', // Information
  '52', // Finance and Insurance
  '54', // Professional, Scientific, Technical Services
  '55', // Management of Companies and Enterprises
  '92', // Public Administration
]

// Two sectors were in this list and came out after looking at what they
// actually contain in a real filing set:
//
//   62 Health Care — included for "corporate roles", but the largest filings
//     are 24Hr Homecare (738), a post-acute rehab and a hospital campus. Those
//     are clinical and care workers, not mid-career knowledge workers.
//   56 Administrative and Support — the filings are Fortrex (sanitation),
//     Silgan Containers (packaging) and a management company. Operational, not
//     knowledge work.
//   61 Educational Services — included on the theory it would surface edtech
//     and university administration. Across eighteen states it promoted three
//     notices and all three were schools: an elementary and secondary school,
//     a community-college foundation, and a flight-training company. Teachers
//     and instructors are not who this pipeline is for.
//
// All three would have added steady noise to a pipeline whose whole value is
// that its leads are worth calling.

export function isKnowledgeSector(industry: string | null | undefined): boolean {
  if (!industry) return false
  const prefix = industry.trim().split(/[\s-]/)[0]
  return KNOWLEDGE_SECTORS.includes(prefix)
}

function cell(row: string[], i: number): string | null {
  const v = row[i]?.trim()
  return v ? v : null
}

/**
 * California EDD's WARN report.
 *
 * Published as a single xlsx covering the current fiscal year, refreshed
 * continuously. The detail sheet's header row is the SECOND row — the first is
 * a title banner — which is why the header is located rather than assumed.
 */
export function parseCaliforniaWarn(buf: Buffer, sourceUrl: string): WarnRow[] {
  const sheets = readXlsx(buf)
  const detail = sheets.find((s) => s.name.trim().toLowerCase().startsWith('detailed warn'))
  if (!detail) throw new Error('CA WARN: no "Detailed WARN Report" sheet — the file layout may have changed.')

  const headerIdx = detail.rows.findIndex((r) => r.some((c) => c.replace(/\s+/g, ' ').trim() === 'Company'))
  if (headerIdx < 0) throw new Error('CA WARN: no header row containing "Company".')

  const header = detail.rows[headerIdx].map((h) => h.replace(/\s+/g, ' ').trim().toLowerCase())
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === n || h.startsWith(n))
      if (i >= 0) return i
    }
    return -1
  }
  const iCompany = col('company')
  const iNotice = col('notice date')
  const iEffective = col('effective date')
  const iCount = col('no. of employees', 'no of employees', 'employees')
  const iType = col('layoff/ closure', 'layoff/closure')
  const iCounty = col('county/parish', 'county')
  const iAddress = col('address')
  const iIndustry = col('related industry', 'industry')

  const out: WarnRow[] = []
  for (const row of detail.rows.slice(headerIdx + 1)) {
    const employer = cell(row, iCompany)
    if (!employer) continue
    const countRaw = iCount >= 0 ? cell(row, iCount) : null
    const employees = countRaw ? parseInt(countRaw.replace(/[^\d]/g, ''), 10) : null

    out.push({
      state: 'CA',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: iNotice >= 0 ? excelSerialToDate(cell(row, iNotice)) : null,
      effectiveDate: iEffective >= 0 ? excelSerialToDate(cell(row, iEffective)) : null,
      employees: Number.isFinite(employees) && employees! > 0 ? employees : null,
      layoffType: iType >= 0 ? cell(row, iType) : null,
      county: iCounty >= 0 ? cell(row, iCounty) : null,
      address: iAddress >= 0 ? cell(row, iAddress) : null,
      industry: iIndustry >= 0 ? cell(row, iIndustry) : null,
    })
  }
  return out.filter((r) => r.employer.toLowerCase() !== 'company')
}

/** Several state sites return 403 to a default fetch user agent. */
export const WARN_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export interface WarnSource {
  state: string
  /**
   * A function when the address depends on the calendar — Florida files by
   * year, and a string computed at import time would go stale on 1 January
   * without anything failing visibly.
   */
  url: string | (() => string)
  /** 'xlsx' is fetched as bytes; 'json' and 'html' as text. */
  format: 'xlsx' | 'json' | 'html'
  parse: (buf: Buffer, url: string) => WarnRow[]
  /**
   * Second pass for sources that split a notice across two pages.
   *
   * The Geographic Solutions portals list notices without a headcount and put
   * it on each notice's own page, so the rows are useless until it is fetched.
   */
  enrich?: (rows: WarnRow[]) => Promise<WarnRow[]>
  /**
   * Finds the real data URL when the page only links to it.
   *
   * Colorado publishes a Google Sheet per year and Rhode Island a spreadsheet
   * whose path carries its upload month. Hard-coding either one keeps working
   * after it goes stale, which is the worst way for a sync to fail.
   */
  resolve?: () => Promise<string>
  /**
   * Whether this source publishes an industry sector.
   *
   * It decides whether notices can be promoted automatically. Without a
   * sector there is no way to tell a software reduction from a cannery
   * closure, and auto-promoting on size alone would fill the pipeline with
   * leads nobody will call — so those sources stage for review instead.
   */
  hasIndustry: boolean
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': WARN_USER_AGENT },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.text()
}

export function sourceUrl(source: WarnSource): string {
  return typeof source.url === 'function' ? source.url() : source.url
}

/**
 * Texas Workforce Commission, via the state's Socrata open-data API.
 *
 * A real documented API rather than a file, so it is the easiest source to
 * keep working. It carries a headcount but NO industry, which is why Texas
 * notices stage for review instead of promoting themselves.
 */
export function parseTexasWarn(buf: Buffer, _sourceUrl: string): WarnRow[] {
  const rows = JSON.parse(buf.toString('utf8')) as Record<string, string>[]
  return rows
    .filter((r) => r.job_site_name)
    .map((r) => {
      const count = r.total_layoff_number ? parseInt(String(r.total_layoff_number).replace(/[^\d]/g, ''), 10) : NaN
      return {
        state: 'TX',
        employer: r.job_site_name.trim(),
        normalizedEmployer: normalizeOrgName(r.job_site_name),
        noticeDate: r.notice_date ? new Date(r.notice_date) : null,
        effectiveDate: r.layoff_date ? new Date(r.layoff_date) : null,
        employees: Number.isFinite(count) && count > 0 ? count : null,
        layoffType: null,
        county: r.county_name ?? null,
        address: r.city_name ?? null,
        // Texas publishes no sector. Recorded as null rather than guessed.
        industry: null,
      }
    })
}

/** Where each table-shaped state publishes its notices. */
const TABLE_URLS: Record<string, string | (() => string)> = {
  AK: 'https://jobs.alaska.gov/RR/WARN_notices.htm',
  AL: 'https://www.madeinalabama.com/warn-list/',
  // Florida files by calendar year and 404s without the parameter.
  FL: () => `https://reactwarn.floridajobs.org/WarnList/Records?year=${new Date().getFullYear()}`,
  MD: 'https://www.dllr.state.md.us/employment/warn.shtml',
  IN: 'https://www.in.gov/dwd/warn-notices/current-warn-notices',
  NE: 'https://dol.nebraska.gov/ReemploymentServices/LayoffServices/LayoffsAndDownsizingWARN',
  OR: 'https://ccwd.hecc.oregon.gov/Layoff/WARN',
  SD: 'https://dlr.sd.gov/workforce_services/businesses/warn_notices.aspx',
  UT: 'https://jobs.utah.gov/employer/business/warnnotices.html',
}

/** Only Florida and Maryland publish a sector; the rest stage for review. */
const TABLE_HAS_INDUSTRY = new Set(['FL', 'MD', 'IN'])

/**
 * States whose page is only readable after JavaScript runs, or that refuse
 * scripted requests outright. They are not fetched here — the weekly browser
 * job renders them and posts the HTML to /api/admin/warn/import-html, which
 * runs the same column-mapped parser these sources use.
 */
export const RENDERED_STATES: Record<string, string> = {
  MA: 'https://www.mass.gov/info-details/worker-adjustment-and-retraining-notification-act-warn-layoff-and-closure-updates',
  WI: 'https://dwd.wisconsin.gov/dislocatedworker/warn/',
}

const TABLE_SOURCES: WarnSource[] = TABLE_SPECS.filter((spec) => !(spec.state in RENDERED_STATES)).map((spec) => ({
  state: spec.state,
  url: TABLE_URLS[spec.state],
  format: 'html' as const,
  parse: makeTableParser(spec),
  hasIndustry: TABLE_HAS_INDUSTRY.has(spec.state),
}))

/**
 * Only notices from the last six months are worth a second request.
 *
 * These portals list back to 1999, and enriching every row would mean a few
 * thousand extra fetches a week to learn the headcount of a layoff that
 * happened before the people affected had email.
 */
const ENRICH_WINDOW_DAYS = 180
const ENRICH_MAX = 25

const GEOSOLINC_SOURCES: WarnSource[] = Object.entries(GEOSOLINC_PORTALS).map(([state, host]) => ({
  state,
  url: geosolincUrl(host),
  format: 'html' as const,
  parse: (buf: Buffer) => parseGeosolincList(buf, state),
  hasIndustry: false,
  enrich: async (rows: WarnRow[]) => {
    const cutoff = new Date(Date.now() - ENRICH_WINDOW_DAYS * 86_400_000)
    let budget = ENRICH_MAX
    for (const row of rows as GeosolincRow[]) {
      if (budget <= 0) break
      if (!row.detailPath || row.employees != null) continue
      if (row.noticeDate && row.noticeDate < cutoff) continue
      budget--
      try {
        const res = await fetch(`https://${host}${row.detailPath}`, {
          headers: { 'User-Agent': WARN_USER_AGENT },
          signal: AbortSignal.timeout(20_000),
        })
        if (res.ok) row.employees = parseGeosolincDetail(await res.text())
      } catch {
        // A detail page that will not load leaves the headcount null; the
        // notice still stages, it just cannot pass the size filter.
      }
    }
    return rows
  },
}))

/**
 * The states that can actually be synced, and why the rest are missing.
 *
 * Every state publishes WARN differently and a parser written against a format
 * nobody has looked at silently produces wrong rows, so each entry here was
 * fetched and read before it was added.
 *
 * With a sector, so notices can promote themselves:
 *   CA  xlsx with headcount and sector — still the best source in the country.
 *   CO  a Google Sheet per year, with NAICS; the sheet is discovered from the
 *       page because last year's keeps resolving fine and stops gaining rows.
 *   FL  HTML table, sector written as a name rather than a code.
 *   IN  HTML table with a NAICS code, over a thousand notices.
 *   MD  HTML table with a full six-digit NAICS code.
 *   MS  a PDF per quarter, read with the PDF text reader. Unusually complete:
 *       NAICS code and description alongside the headcount.
 *
 * With a headcount but no sector, so notices stage for review:
 *   TX  Socrata JSON API.
 *   AK AL NE OR SD UT  plain HTML tables.
 *   IA  a "WARN Log" workbook, one sheet per year, resolved from the page.
 *   NJ  a workbook holding every year, linked from a page that renders its own
 *       list client-side; the workbook needs no browser.
 *   RI  a spreadsheet whose URL carries its upload month, so it is resolved
 *       from the page; one sheet per year, newest read.
 *   AZ DE ID KS ME VT  the Geographic Solutions portal, which lists notices
 *       without a headcount and puts it on each notice's own page.
 *
 * Fetched by the weekly browser job instead of here — see RENDERED_STATES:
 *   MA  returns 403 to every scripted request, its own CSV included.
 *   WI  builds its notice list client-side.
 *
 * Checked and NOT usable, so nobody repeats the work:
 *   NY  current notices are a Tableau embed with no data endpoint; the legacy
 *       HTML table has neither headcount nor industry and stops in April 2025.
 *       Covered by layoffs.fyi instead.
 *   NC  Tableau, same problem. Also covered by layoffs.fyi.
 *   MN  sits behind a Radware CAPTCHA.
 *   NH NV  return Akamai "Access Denied" even to a rendered browser, so this
 *       is not a matter of headers.
 *   WA  an ASP.NET search form inside an iframe; submitting it did not return
 *       a results table.
 *   PA  its notices page renders navigation and nothing else, in a browser as
 *       well as a fetch, and links no data file.
 *   NM  publishes a PDF per year whose text extracts cleanly; not wired up yet.
 *   GA IL LA MI VA WV  no machine-readable notice list found. Michigan posts a
 *       PDF per notice with the employer and date in the filename, which is
 *       the most promising of these.
 *   AR DC MT ND OK SC WY  no WARN page found at any address that resolves.
 *   TN  runs the Geographic Solutions portal but does not serve WARN there.
 */
export const WARN_SOURCES: WarnSource[] = [
  {
    state: 'CA',
    url: 'https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx',
    format: 'xlsx',
    parse: parseCaliforniaWarn,
    hasIndustry: true,
  },
  {
    state: 'TX',
    // Most recent first, capped — the dataset goes back to 2019 and only
    // recent filings are worth acting on.
    url: 'https://data.texas.gov/resource/8w53-c4f6.json?$order=notice_date%20DESC&$limit=400',
    format: 'json',
    parse: parseTexasWarn,
    hasIndustry: false,
  },
  ...TABLE_SOURCES,
  ...GEOSOLINC_SOURCES,
  {
    state: 'CO',
    url: COLORADO_PAGE,
    format: 'html',
    resolve: async () => {
      const html = await fetchText(COLORADO_PAGE)
      const sheet = resolveColoradoSheet(html)
      if (!sheet) throw new Error('CO: no WARN sheet linked for the current year')
      return sheet
    },
    parse: parseColoradoWarn,
    hasIndustry: true,
  },
  {
    state: 'IA',
    url: IOWA_PAGE,
    format: 'xlsx',
    resolve: async () => {
      const html = await fetchText(IOWA_PAGE)
      const file = resolveIowaFile(html)
      if (!file) throw new Error('IA: no WARN log workbook linked')
      return file
    },
    parse: (buf: Buffer) => parseIowaWarn(readXlsx(buf)),
    hasIndustry: false,
  },
  {
    state: 'MS',
    url: MISSISSIPPI_PAGE,
    format: 'xlsx', // fetched as bytes; it is a PDF, parsed below
    resolve: async () => {
      const html = await fetchText(MISSISSIPPI_PAGE)
      const pdf = resolveMississippiPdf(html)
      if (!pdf) throw new Error('MS: no quarterly WARN PDF linked')
      return pdf
    },
    parse: (buf: Buffer) => parseMississippiWarn(pdfText(buf)),
    hasIndustry: true,
  },
  {
    state: 'NJ',
    url: NEW_JERSEY_FILE,
    format: 'xlsx',
    parse: (buf: Buffer) => parseNewJerseyWarn(readXlsx(buf)),
    hasIndustry: false,
  },
  {
    state: 'RI',
    url: RHODE_ISLAND_PAGE,
    format: 'xlsx',
    resolve: async () => {
      const html = await fetchText(RHODE_ISLAND_PAGE)
      const file = resolveRhodeIslandFile(html)
      if (!file) throw new Error('RI: no spreadsheet linked on the WARN page')
      return file
    },
    parse: (buf: Buffer) => parseRhodeIslandWarn(readXlsx(buf)),
    hasIndustry: false,
  },
]
