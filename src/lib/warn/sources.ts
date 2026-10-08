import { readXlsx, excelSerialToDate, type XlsxSheet } from './xlsx'
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
  northCarolinaPage,
  resolveNorthCarolinaFile,
  parseNorthCarolinaWarn,
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
  /** Null only for a manually-entered notice with no single filing state. */
  state: string | null
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
 * Texas Workforce Commission's yearly WARN workbook.
 *
 * The state's open-data API, which this used to read, stopped being updated
 * on 7 July 2026; the commission's own page still posts a workbook per year, current to the
 * week. It carries the same columns under the same names, with dates as
 * Excel day numbers. The site refuses scripted requests, so the weekly
 * browser job downloads the file and posts it here — see FILE_STATES.
 */
export function parseTexasWorkbook(sheets: XlsxSheet[]): WarnRow[] {
  const rows = sheets[0]?.rows ?? []
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const c = {
    notice: col('notice_date'), site: col('job_site_name'), county: col('county_name'),
    count: col('total_layoff_number'), layoff: col('layoff_date'), city: col('city_name'),
  }
  if (c.notice < 0 || c.site < 0) throw new Error('TX: the workbook no longer has NOTICE_DATE and JOB_SITE_NAME columns')

  // Excel counts days from 30 Dec 1899; a cell may also already be a date string.
  const date = (v: string | undefined): Date | null => {
    if (!v) return null
    const n = Number(v)
    const d = Number.isFinite(n) && n > 20_000 && n < 80_000 ? new Date(Date.UTC(1899, 11, 30) + n * 86_400_000) : new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const out: WarnRow[] = []
  for (const r of rows.slice(1)) {
    const employer = String(r[c.site] ?? '').trim()
    if (!employer) continue
    const count = parseInt(String(r[c.count] ?? '').replace(/[^\d]/g, ''), 10)
    out.push({
      state: 'TX',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: date(r[c.notice]),
      effectiveDate: date(r[c.layoff]),
      employees: Number.isFinite(count) && count > 0 ? count : null,
      layoffType: null,
      county: String(r[c.county] ?? '').trim() || null,
      address: String(r[c.city] ?? '').trim() || null,
      // Texas publishes no sector. Recorded as null rather than guessed.
      industry: null,
    })
  }
  return out
}

/**
 * States whose notices are a file that only a rendered browser can download.
 * The weekly browser job opens `page`, finds the newest link matching
 * `link`, and posts the file to /api/admin/warn/import-file.
 */
export const FILE_STATES: Record<string, { page: string; link: string; parse: (buf: Buffer) => WarnRow[]; hasIndustry: boolean }> = {
  TX: {
    page: 'https://www.twc.texas.gov/data-reports/warn-notice',
    link: 'warn-act-listings',
    parse: (buf) => parseTexasWorkbook(readXlsx(buf)),
    hasIndustry: false,
  },
  // Rhode Island began answering scripted requests with 403 in autumn 2026.
  RI: {
    page: RHODE_ISLAND_PAGE,
    link: '.xls',
    parse: (buf) => parseRhodeIslandWarn(readXlsx(buf)),
    hasIndustry: false,
  },
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
/**
 * States read by Big Local News's open-source WARN scrapers (warn-scraper,
 * Apache 2.0, Stanford) in the daily browser job, standardized by its
 * warn-transformer, and posted to /api/admin/warn/import-rows. Each maps to
 * the state's own WARN page, recorded as the notice's source — the data is
 * the state's public record; the scraper only reads it.
 *
 * These are the states whose pages are PDFs, dashboards or search forms that
 * our own fetchers could not read.
 */
export const SCRAPED_STATES: Record<string, string> = {
  CT: 'https://dolpublicdocumentlibrary.ct.gov/CsblrCategory?prefix=%2Frapid_response%2Fwarn_documents',
  DC: 'https://does.dc.gov/page/industry-closings-and-layoffs-warn-notifications',
  GA: 'https://www.tcsg.edu/warn-public-view/',
  HI: 'https://labor.hawaii.gov/wdc/real-time-warn-updates/',
  IL: 'https://www2.illinois.gov/dceo/WorkforceDevelopment/warn/Pages/default.aspx',
  KY: 'https://kcc.ky.gov/employer/Pages/Business-Downsizing-Assistance---WARN.aspx',
  LA: 'https://www.laworks.net/Downloads/Downloads_WFD.asp',
  MI: 'https://www.michigan.gov/leo/bureaus-agencies/wd/data-public-notices/warn-notices',
  MO: 'https://jobs.mo.gov/warn/',
  MT: 'https://wsd.dli.mt.gov/wioa/related-links/warn-notice-page',
  ND: 'https://www.jobsnd.com/documents',
  NM: 'https://www.dws.state.nm.us/Rapid-Response',
  NY: 'https://dol.ny.gov/warn-notices',
  OH: 'https://jfs.ohio.gov/warn/index.stm',
  OK: 'https://www.employoklahoma.gov/Participants/s/warnnotices',
  PA: 'https://www.pa.gov/agencies/dli/programs-services/workforce-development-home/warn-requirements/warn-notices',
  SC: 'https://scworks.org/employer/employer-programs/risk-closing/layoff-notification-reports',
  TN: 'https://www.tn.gov/workforce/general-resources/major-publications0/major-publications-redirect/reports.html',
  VA: 'https://www.vec.virginia.gov/warn-notices',
  WA: 'https://esd.wa.gov/about-employees/WARN',
}

/** One notice as warn-transformer standardizes it. */
export interface ScrapedNotice {
  company: string | null
  location: string | null
  notice_date: string | null
  effective_date: string | null
  jobs: number | null
  is_closure?: boolean | null
  is_temporary?: boolean | null
  is_amendment?: boolean | null
}

const isoDate = (v: string | null | undefined): Date | null => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
}

/** The standardized notices for one state as our rows. Amendments repeat a notice already filed, so they are left out. */
export function parseScrapedNotices(state: string, notices: ScrapedNotice[]): WarnRow[] {
  return notices
    .filter((n) => n.company?.trim() && !n.is_amendment)
    .map((n) => {
      const employer = n.company!.replace(/\s+/g, ' ').trim()
      return {
        state,
        employer,
        normalizedEmployer: normalizeOrgName(employer),
        noticeDate: isoDate(n.notice_date),
        effectiveDate: isoDate(n.effective_date),
        employees: typeof n.jobs === 'number' && Number.isFinite(n.jobs) && n.jobs >= 0 ? Math.round(n.jobs) : null,
        layoffType: n.is_closure === true ? 'Closure' : n.is_closure === false ? (n.is_temporary ? 'Temporary layoff' : 'Layoff') : null,
        county: null,
        address: n.location?.replace(/\s+/g, ' ').trim() || null,
        industry: null,
      }
    })
}

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
 *   AK AL NE OR SD UT  plain HTML tables.
 *   IA  a "WARN Log" workbook, one sheet per year, resolved from the page.
 *   NJ  a workbook holding every year, linked from a page that renders its own
 *       list client-side; the workbook needs no browser.
 *   AZ DE ID KS ME VT  the Geographic Solutions portal, which lists notices
 *       without a headcount and puts it on each notice's own page.
 *
 * Fetched by the weekly browser job instead of here — see RENDERED_STATES:
 *   MA  returns 403 to every scripted request, its own CSV included.
 *   WI  builds its notice list client-side.
 *   RI  a spreadsheet linked from a page that now refuses scripted requests;
 *       one sheet per year, newest read. See FILE_STATES.
 *   TX  a workbook per year on a site that refuses scripted requests — see
 *       FILE_STATES. Headcount, no sector. (Its open-data API went stale in
 *       July 2026 and is no longer read.)
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
    state: 'NC',
    url: () => northCarolinaPage(),
    format: 'html', // fetched as text; it is a CSV
    resolve: async () => {
      const html = await fetchText(northCarolinaPage())
      const file = resolveNorthCarolinaFile(html)
      if (!file) throw new Error('NC: no WARN CSV linked on this year\'s summary page')
      return file
    },
    parse: (buf: Buffer) => parseNorthCarolinaWarn(buf),
    hasIndustry: false,
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
]
