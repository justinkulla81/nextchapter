import { normalizeOrgName } from '@/lib/text/org-name-match'
import { readTables, columnOf, parseDate, parseCount, stripTags } from './html'
import { parseCsv } from './csv'
import { excelSerialToDate, type XlsxSheet } from './xlsx'
import type { WarnRow } from './sources'
import { columnEdges, fixedEdges, pdfPages, pdfTableRows, type ColumnEdges, type ColumnSpec, type PdfItem } from './pdf-table'

/**
 * A state whose WARN page is a plain HTML table.
 *
 * Each state is a column map rather than a bespoke parser: the columns are
 * matched by header text, so a state that reorders or renames a column fails
 * loudly (no match) instead of silently reading the wrong field.
 */
export interface TableSpec {
  state: string
  /** Header names to look for, first match wins. */
  employer: string[]
  noticeDate: string[]
  effectiveDate?: string[]
  employees?: string[]
  industry?: string[]
  location?: string[]
  layoffType?: string[]
}

export const TABLE_SPECS: TableSpec[] = [
  {
    state: 'AK',
    employer: ['Company'], noticeDate: ['Notice Date'], effectiveDate: ['Layoff Date'],
    employees: ['Employees Affected'], location: ['Location'],
  },
  {
    state: 'AL',
    employer: ['Company'], noticeDate: ['Initial Report Date'], effectiveDate: ['Planned Starting Date'],
    employees: ['Planned # of Affected', 'Affected'], location: ['City'], layoffType: ['Closing or Layoff'],
  },
  {
    state: 'FL',
    employer: ['Company Name'], noticeDate: ['State Notification Date', 'Notification'], effectiveDate: ['Layoff Date'],
    employees: ['Employees Affected'], industry: ['Industry'],
  },
  {
    state: 'MD',
    employer: ['Company'], noticeDate: ['Notice Date'], effectiveDate: ['Effective Date'],
    employees: ['Total Employees'], industry: ['NAICS Code', 'NAICS'], location: ['Location'], layoffType: ['Type'],
  },
  {
    // Indiana publishes a NAICS code alongside the headcount, so its notices
    // can promote themselves.
    state: 'IN',
    employer: ['Company'], noticeDate: ['Notice Date'], effectiveDate: ['LO/CL Date'],
    employees: ['Affected Workers'], industry: ['NAICS'], location: ['City'],
    layoffType: ['Notice Type'],
  },
  {
    state: 'NE',
    employer: ['Company'], noticeDate: ['Date'], employees: ['Jobs Affected'], location: ['Location'],
  },
  {
    // Georgia (Technical College System of Georgia, which took over WARN on 1 Jan 2023) builds its list in the browser from a
    // WordPress data call that needs a page-issued token, so the weekly browser job renders it (RENDERED_STATES). The table has
    // the company, the date it was submitted and the number affected; the county and separation dates sit on each entry's page.
    state: 'GA',
    employer: ['Company Name'], noticeDate: ['Submitted Date'], employees: ['Total Number of Affected Employees', 'Affected'],
  },
  {
    state: 'OR',
    employer: ['Employer'], noticeDate: ['Notification Date'], employees: ['Count'],
    location: ['City'], layoffType: ['Layoff Type'],
  },
  {
    state: 'SD',
    employer: ['Company'], noticeDate: ['Date Received'], employees: ['Employees Affected'], location: ['Location'],
  },
  {
    // Rendered by the browser job: mass.gov returns 403 to every scripted
    // request, its CSV included, but serves a real browser normally.
    state: 'MA',
    employer: ['Employer'], noticeDate: ['Received'], effectiveDate: ['Date(s) of Layoffs', 'Date of Layoffs'],
    employees: ['# Employees Impacted', 'Employees Impacted'], location: ['City/Town', 'City'],
  },
  {
    // Rendered by the browser job: the list is built client-side.
    state: 'WI',
    employer: ['Company'], noticeDate: ['Notice Received'], effectiveDate: ['Layoff Begin Date'],
    employees: ['Affected Workers'], industry: ['NAICS Description'], location: ['City'],
    layoffType: ['Original Notice Type'],
  },
  {
    state: 'UT',
    employer: ['Company Name'], noticeDate: ['Date of Notice'], employees: ['Affected Workers'], location: ['Location'],
  },
]

/**
 * NAICS sector names, for states that print the name instead of the code.
 *
 * Florida publishes "Professional, Scientific, and Technical Services" where
 * Maryland publishes 541511. Both have to end up as the same two-digit sector
 * or the knowledge-work filter only works on half the country.
 */
const SECTOR_NAMES: [RegExp, string][] = [
  [/information/i, '51'],
  [/finance|insurance/i, '52'],
  [/professional.*scientific|scientific.*technical/i, '54'],
  [/management of companies/i, '55'],
  [/educational/i, '61'],
  [/public administration/i, '92'],
  [/real estate/i, '53'],
  [/health care|social assistance/i, '62'],
  [/administrative|waste management/i, '56'],
  [/manufactur/i, '31'],
  [/retail/i, '44'],
  [/wholesale/i, '42'],
  [/transportation|warehous/i, '48'],
  [/accommodation|food service/i, '72'],
  [/construction/i, '23'],
  [/utilities/i, '22'],
  [/mining|quarry|oil and gas/i, '21'],
  [/agricultur|forestry|fishing/i, '11'],
  [/arts|entertainment|recreation/i, '71'],
]

/**
 * Normalizes whatever a state calls its industry into a leading sector code.
 *
 * Maryland publishes a full 6-digit NAICS code and Florida a sector name; the
 * filter reads the leading two digits either way. The original text is kept
 * alongside so the review page still shows something a person can read.
 */
function normalizeIndustry(raw: string | null, state: string): string | null {
  if (!raw) return null
  const v = raw.trim()
  if (!v) return null

  const digits = v.match(/^(\d{2})\d{2,4}$/)
  if (digits) return `${digits[1]} (NAICS ${v})`

  // Some states give a sector range rather than a code: "31-33".
  const range = v.match(/^(\d{2})\s*[-–]\s*\d{2}$/)
  if (range) return `${range[1]} (NAICS ${v})`

  // Colorado writes "52: Finance and Insurance" and "54,1714 R&D in Biotech".
  const leading = v.match(/^(\d{2})\D/)
  if (leading) {
    const rest = v.replace(/^\d{2}[:,\s-]*/, '').trim()
    return rest ? `${leading[1]} - ${rest}` : `${leading[1]} (NAICS ${v})`
  }

  const named = SECTOR_NAMES.find(([re]) => re.test(v))
  if (named) return `${named[1]} - ${v}`

  // An unrecognized label is kept verbatim rather than guessed at; it simply
  // will not match the knowledge-sector filter.
  return state === 'MD' ? null : v
}

/** Rows whose "employer" is really a repeated or machine-readable header. */
const HEADER_WORDS = new Set(['name', 'company', 'employer', 'company name', 'employer name'])

/** Builds a parser for one table-shaped state source. */
export function makeTableParser(spec: TableSpec) {
  return function parse(buf: Buffer, _sourceUrl: string): WarnRow[] {
    const out: WarnRow[] = []
    const seen = new Set<string>()

    // Every matching table on the page is read, not just the largest: several
    // states file one table per year on a single page.
    for (const rows of readTables(buf.toString('utf8'))) {
      if (rows.length < 2) continue

      const header = rows[0]
      const iEmployer = columnOf(header, ...spec.employer)
      const iNotice = columnOf(header, ...spec.noticeDate)
      if (iEmployer === -1 || iNotice === -1) continue

      const iEffective = spec.effectiveDate ? columnOf(header, ...spec.effectiveDate) : -1
      const iEmployees = spec.employees ? columnOf(header, ...spec.employees) : -1
      const iIndustry = spec.industry ? columnOf(header, ...spec.industry) : -1
      const iLocation = spec.location ? columnOf(header, ...spec.location) : -1
      const iType = spec.layoffType ? columnOf(header, ...spec.layoffType) : -1

      const at = (r: string[], i: number) => (i >= 0 ? (r[i]?.trim() || null) : null)

      for (const row of rows.slice(1)) {
        const employer = at(row, iEmployer)
        // Pagination controls, footers and repeated machine-readable headers
        // all land in the same table.
        if (!employer || employer.length < 2) continue
        if (HEADER_WORDS.has(employer.toLowerCase())) continue
        if (/^[\d\s>«»|]+$/.test(employer)) continue

        const noticeDate = parseDate(at(row, iNotice))
        const key = `${employer.toLowerCase()}|${noticeDate?.toISOString() ?? ''}`
        if (seen.has(key)) continue
        seen.add(key)

        out.push({
          state: spec.state,
          employer,
          normalizedEmployer: normalizeOrgName(employer),
          noticeDate,
          effectiveDate: parseDate(at(row, iEffective)),
          employees: parseCount(at(row, iEmployees)),
          layoffType: at(row, iType),
          county: null,
          address: at(row, iLocation),
          industry: normalizeIndustry(at(row, iIndustry), spec.state),
        })
      }
    }
    return out
  }
}

/**
 * Geographic Solutions runs the job portal for six states, all serving WARN
 * at the same path with the same markup. One parser covers all of them.
 *
 * Tennessee runs the same portal but does not expose WARN at this path — its
 * page returns only site navigation — so it is not in the list.
 *
 * The list page has no headcount — that lives on each notice's detail page, so
 * rows are enriched with a second request. Only the newest page is read, which
 * is what a weekly sync needs; the archives go back to 1999 and nobody is
 * calling those.
 */
export const GEOSOLINC_PORTALS: Record<string, string> = {
  AZ: 'www.azjobconnection.gov',
  DE: 'joblink.delaware.gov',
  ID: 'idahoworks.gov',
  KS: 'www.kansasworks.com',
  ME: 'joblink.maine.gov',
  VT: 'vermontjoblink.com',
}

export function geosolincUrl(host: string): string {
  return `https://${host}/search/warn_lookups?q%5Bservice_delivery_area_id_eq%5D=&q%5Bs%5D=notice_on+desc&commit=Search`
}

/** Row plus the detail path the headcount has to be fetched from. */
export interface GeosolincRow extends WarnRow {
  detailPath: string | null
}

export function parseGeosolincList(buf: Buffer, state: string): GeosolincRow[] {
  const html = buf.toString('utf8')
  const tables = readTables(html)
  const rows = tables.find((t) => columnOf(t[0], 'Employer', 'Company') !== -1) ?? []
  if (rows.length < 2) return []

  // Detail links appear in document order, one per data row.
  const links = [...html.matchAll(/href="(\/search\/warn_lookups\/\d+)"/g)].map((m) => m[1])

  const header = rows[0]
  const iEmployer = columnOf(header, 'Employer', 'Company')
  const iCity = columnOf(header, 'City')
  const iNotice = columnOf(header, 'Notice Date', 'Notice')
  const iType = columnOf(header, 'WARN Type', 'Type')
  if (iEmployer === -1) return []

  const out: GeosolincRow[] = []
  let n = 0
  for (const row of rows.slice(1)) {
    const employer = row[iEmployer]?.trim()
    if (!employer || employer.length < 2) continue
    out.push({
      state,
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(iNotice >= 0 ? row[iNotice] : null),
      effectiveDate: null,
      employees: null,
      layoffType: iType >= 0 ? (row[iType]?.trim() || null) : null,
      county: null,
      address: iCity >= 0 ? (row[iCity]?.trim() || null) : null,
      industry: null,
      detailPath: links[n++] ?? null,
    })
  }
  return out
}

/** Reads "Number of Employees Affected" off a geosolinc detail page. */
export function parseGeosolincDetail(html: string): number | null {
  const text = stripTags(html)
  const m = text.match(/Number of Employees Affected\s*([\d,]+)/i)
  return m ? parseCount(m[1]) : null
}

/**
 * Colorado files one Google Sheet per year and links them all from one page,
 * so the sheet to read has to be discovered rather than hard-coded — last
 * year's sheet keeps resolving fine and quietly stops gaining rows.
 *
 * The payoff is worth the extra request: Colorado's sheet carries a NAICS
 * sector, which puts it in the small group of states whose notices can be
 * promoted without a person reading them.
 */
export const COLORADO_PAGE = 'https://cdle.colorado.gov/employers/layoff-separations/layoff-warn-list'

export function resolveColoradoSheet(pageHtml: string, year = new Date().getFullYear()): string | null {
  const links = [...pageHtml.matchAll(
    /<a[^>]*href="(https:\/\/docs\.google\.com\/spreadsheets\/d\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  )]
  const label = (text: string) => stripTags(text).toLowerCase()
  // "View Real-Time 2026 Warns" is the live one; fall back to the year alone.
  const match =
    links.find((m) => label(m[2]).includes(String(year)) && label(m[2]).includes('real-time')) ??
    links.find((m) => label(m[2]).includes(String(year))) ??
    links.find((m) => label(m[2]).includes(String(year - 1)))
  if (!match) return null

  const href = match[1]
  const id = href.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1]
  if (!id) return null
  const gid = href.match(/[#?&]gid=(\d+)/)?.[1]
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`
}

export function parseColoradoWarn(buf: Buffer): WarnRow[] {
  const rows = parseCsv(buf.toString('utf8'))
  if (rows.length < 2) return []

  const header = rows[0]
  const iCompany = columnOf(header, 'Company')
  const iDate = columnOf(header, 'WARN Date', 'Received')
  const iTotal = columnOf(header, 'Total Notified', 'CO Notifications')
  const iNaics = columnOf(header, 'NAICS')
  const iBegin = columnOf(header, 'Begin Date')
  const iArea = columnOf(header, 'Workforce Area')
  const iReason = columnOf(header, 'Reason for Layoffs', 'Reason')
  if (iCompany === -1) return []

  const out: WarnRow[] = []
  for (const row of rows.slice(1)) {
    const employer = row[iCompany]?.trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
    out.push({
      state: 'CO',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(iDate >= 0 ? row[iDate] : null),
      effectiveDate: parseDate(iBegin >= 0 ? row[iBegin] : null),
      employees: parseCount(iTotal >= 0 ? row[iTotal] : null),
      layoffType: iReason >= 0 ? (row[iReason]?.trim() || null) : null,
      county: null,
      address: iArea >= 0 ? (row[iArea]?.trim() || null) : null,
      industry: normalizeIndustry(iNaics >= 0 ? row[iNaics] : null, 'CO'),
    })
  }
  return out
}

/**
 * Ohio publishes the year's notices as a CSV behind a page that builds its
 * table in the browser; the file sits at a predictable address per year.
 * Two filler rows come before the header. "City/County" holds both.
 */
export const ohioWarnFile = (year = new Date().getFullYear()) =>
  `https://dam.assets.ohio.gov/raw/upload/jfs.ohio.gov/${year}/${year}-warn-notice.csv`
export const OHIO_PAGE =
  'https://jfs.ohio.gov/job-workforce-services/job-programs-and-services/submit-a-warn-notice/current-public-notices-of-layoffs-and-closures'

export function parseOhioWarn(buf: Buffer): WarnRow[] {
  const rows = parseCsv(buf.toString('utf8').replace(/^\uFEFF/, ''))
  const h = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === 'company'))
  if (h === -1) return []
  const header = rows[h]
  const iCompany = columnOf(header, 'Company')
  const iDate = columnOf(header, 'Date Received')
  const iPlace = columnOf(header, 'City/County', 'City')
  const iType = columnOf(header, 'Layoff/Closure')
  const iCount = columnOf(header, 'Number Affected')
  const iLayoff = columnOf(header, 'Layoff Date')
  const out: WarnRow[] = []
  for (const row of rows.slice(h + 1)) {
    const employer = row[iCompany]?.trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
    const [city, county] = (iPlace >= 0 ? row[iPlace] ?? '' : '').split('/').map((x) => x.trim())
    out.push({
      state: 'OH',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(iDate >= 0 ? row[iDate] : null),
      effectiveDate: parseDate(iLayoff >= 0 ? row[iLayoff] : null),
      employees: parseCount(iCount >= 0 ? row[iCount] : null),
      layoffType: iType >= 0 ? (row[iType]?.trim() || null) : null,
      county: county || null,
      address: city ? `${city}, OH` : null,
      industry: null,
    })
  }
  return out
}

/**
 * Michigan lists notices through its site search, which returns each notice
 * as an HTML fragment: the company in an <h3>, then labelled lines. A notice
 * covering several sites has "Site addresses:" with a nested list. The
 * notice date is only in the path the search stores it under.
 */
export const MICHIGAN_PAGE = 'https://www.michigan.gov/leo/bureaus-agencies/wd/data-public-notices/warn-notices'
export const MICHIGAN_SEARCH =
  'https://www.michigan.gov/leo/sxa/search/results/?s=%7B8E97AB1D-D2D4-47F8-8CC4-3F1039C8854F%7D&itemid=%7BBE81F7C2-36A8-4FDE-853C-B05B6E090055%7D&v=%7B1FFFCC21-5151-4A2B-ABFC-F7FE4E5C9783%7D&p=500&o=Created%20Date%20sort%2CDescending'

export function parseMichiganWarn(buf: Buffer): WarnRow[] {
  let data: { Results?: { Path?: string; Html?: string }[] }
  try { data = JSON.parse(buf.toString('utf8')) } catch { return [] }
  const out: WarnRow[] = []
  for (const r of data.Results ?? []) {
    const html = r.Html ?? ''
    // Newer notices put the company in an <h3>; older ones in the title link.
    const employer = stripTags(
      html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? html.match(/class="content-title-link"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '',
    ).trim()
    if (!employer) continue
    // label → the text after it, up to the end of its list item or line.
    const field = (label: RegExp) => {
      const m = html.match(new RegExp(`<strong>\\s*${label.source}\\s*:?\\s*<\\/strong>([\\s\\S]*?)(?:<br|<\\/li>|<\\/p>)`, 'i'))
      return m ? stripTags(m[1]).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || null : null
    }
    // Several sites: the first one (the nested list's first item).
    const multi = html.match(/Site addresses[\s\S]*?<li[^>]*>([\s\S]*?)<\/li>/i)?.[1]
    const address = (multi ? stripTags(multi) : field(/Site address/) ?? field(/City/))?.replace(/\s+/g, ' ').trim() || null
    const posted = r.Path?.match(/SearchData\/(\d{4})\/(\d{2})\/(\d{2})/i)
    out.push({
      state: 'MI',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: posted ? new Date(Date.UTC(Number(posted[1]), Number(posted[2]) - 1, Number(posted[3]))) : null,
      effectiveDate: parseDate(field(/Layoff date/) ?? field(/Commencing date/)),
      employees: parseCount(field(/Number of jobs impacted/)),
      layoffType: field(/Type of company action/),
      county: field(/County/),
      address,
      industry: null,
    })
  }
  return out
}

/**
 * DC posts each year's notices as a table on its own page. Effective dates
 * can be a range ("May 19 - June 2, 2026"); the first day is used. Code 1 is
 * a layoff, 2 a permanent closure.
 */
export const dcWarnPage = (year = new Date().getFullYear()) =>
  `https://does.dc.gov/page/industry-closings-and-layoffs-warn-notifications-${year}`

export function firstDayOfRange(raw: string | null | undefined): Date | null {
  const s = (raw ?? '').trim()
  const range = s.match(/^([A-Za-z]+\.? \d{1,2})\s*[-–]\s*.*?(\d{4})$/)
  return parseDate(range ? `${range[1]}, ${range[2]}` : s)
}

export function parseDcWarn(buf: Buffer): WarnRow[] {
  const out: WarnRow[] = []
  for (const table of readTables(buf.toString('utf8'))) {
    const header = table[0] ?? []
    const iName = columnOf(header, 'Organization Name', 'Company')
    if (iName === -1) continue
    const iDate = columnOf(header, 'Notice Date')
    const iCount = columnOf(header, 'Employees Affected', 'Number')
    const iEffective = columnOf(header, 'Effective')
    const iCode = columnOf(header, 'Code')
    for (const row of table.slice(1)) {
      const employer = row[iName]?.trim()
      if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
      const code = iCode >= 0 ? row[iCode]?.trim() : ''
      out.push({
        state: 'DC',
        employer,
        normalizedEmployer: normalizeOrgName(employer),
        noticeDate: parseDate(iDate >= 0 ? row[iDate] : null),
        effectiveDate: firstDayOfRange(iEffective >= 0 ? row[iEffective] : null),
        employees: parseCount(iCount >= 0 ? row[iCount] : null),
        layoffType: code === '2' ? 'Closure' : code === '1' ? 'Layoff' : null,
        county: null,
        address: 'Washington, DC',
        industry: null,
      })
    }
  }
  return out
}

/**
 * North Carolina posts the year's notices as a CSV on its Commerce
 * department's site. The file name and version change with each update, so
 * the link is read off the year's summary page.
 */
export const northCarolinaPage = (year = new Date().getFullYear()) =>
  `https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports/report-workforce-warn-summary-list-${year}`

export function resolveNorthCarolinaFile(pageHtml: string): string | null {
  const href = pageHtml.match(/href="([^"]*files\.nc\.gov\/commerce\/[^"]+\.csv[^"]*)"/i)?.[1]
  return href ? href.replace(/&amp;/g, '&') : null
}

export function parseNorthCarolinaWarn(buf: Buffer): WarnRow[] {
  const rows = parseCsv(buf.toString('utf8').replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const header = rows[0]
  const iCompany = columnOf(header, 'Notice Name', 'Employer')
  const iDate = columnOf(header, 'Date of Notice')
  const iEffective = columnOf(header, 'Effective Date')
  const iCount = columnOf(header, 'Number affected')
  const iCounty = columnOf(header, 'County')
  const iAddress = columnOf(header, 'Address 1')
  const iCity = columnOf(header, 'City')
  const iType = columnOf(header, 'notice type')
  if (iCompany === -1) return []

  const out: WarnRow[] = []
  for (const row of rows.slice(1)) {
    const employer = row[iCompany]?.trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
    const city = iCity >= 0 ? row[iCity]?.trim() : ''
    const street = iAddress >= 0 ? row[iAddress]?.trim() : ''
    out.push({
      state: 'NC',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(iDate >= 0 ? row[iDate] : null),
      effectiveDate: parseDate(iEffective >= 0 ? row[iEffective] : null),
      employees: parseCount(iCount >= 0 ? row[iCount] : null),
      layoffType: iType >= 0 ? (row[iType]?.trim() || null) : null,
      county: iCounty >= 0 ? (row[iCounty]?.trim() || null) : null,
      address: [street, city && `${city}, NC`].filter(Boolean).join(', ') || null,
      industry: null,
    })
  }
  return out
}

/**
 * Rhode Island posts a spreadsheet whose URL carries the month it was uploaded,
 * so the link is read off the page rather than hard-coded. The workbook holds
 * one sheet per year; only the newest is read.
 */
export const RHODE_ISLAND_PAGE =
  'https://dlt.ri.gov/employers/worker-adjustment-and-retraining-notification-warn'

export function resolveRhodeIslandFile(pageHtml: string): string | null {
  const href = pageHtml.match(/href="([^"]+\.xlsx?)"/i)?.[1]
  if (!href) return null
  return href.startsWith('http') ? href : `https://dlt.ri.gov${href}`
}

export function parseRhodeIslandWarn(sheets: { name: string; rows: (string | number)[][] }[]): WarnRow[] {
  // Sheets are named by year; take the highest.
  const sheet = [...sheets].sort((a, b) => (parseInt(b.name, 10) || 0) - (parseInt(a.name, 10) || 0))[0]
  if (!sheet) return []

  // The header sits a few rows down, under a report title.
  const headerIndex = sheet.rows.findIndex((r) => r.some((c) => String(c).toLowerCase().includes('company name')))
  if (headerIndex === -1) return []

  const header = sheet.rows[headerIndex].map((c) => String(c))
  const iCompany = columnOf(header, 'Company Name')
  const iWarn = columnOf(header, 'WARN Date')
  const iAffected = columnOf(header, 'Number Affected')
  const iEffective = columnOf(header, 'Effective Date')
  const iLocation = columnOf(header, 'Location of Layoffs', 'Location')
  if (iCompany === -1) return []

  const out: WarnRow[] = []
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    const employer = String(row[iCompany] ?? '').trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
    out.push({
      state: 'RI',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: excelSerialToDate(row[iWarn] as string | number) ?? parseDate(String(row[iWarn] ?? '')),
      effectiveDate:
        excelSerialToDate(row[iEffective] as string | number) ?? parseDate(String(row[iEffective] ?? '')),
      employees: parseCount(String(row[iAffected] ?? '')),
      layoffType: null,
      county: null,
      address: iLocation >= 0 ? String(row[iLocation] ?? '').trim() || null : null,
      industry: null,
    })
  }
  return out
}

/**
 * New Jersey keeps every year in one workbook, a sheet per year, and links it
 * from the WARN page as a plain file — so it needs no browser even though the
 * page itself renders its notice list with JavaScript.
 *
 * The sheet has no notice date, only a "Month Posted" column, so the notice
 * date is reconstructed from that month and the sheet's year. That is accurate
 * to the month, which is all the recency filter and the sort need.
 */
export const NEW_JERSEY_FILE = 'https://www.nj.gov/labor/assets/PDFs/WARN/WARN_Notice_Archive.xlsx'

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

export function parseNewJerseyWarn(sheets: { name: string; rows: (string | number)[][] }[]): WarnRow[] {
  // Sheets are named "2026 WARN Notices"; take the highest year.
  const withYear = sheets
    .map((s) => ({ sheet: s, year: parseInt(s.name.match(/(20\d{2})/)?.[1] ?? '', 10) }))
    .filter((s) => Number.isFinite(s.year))
    .sort((a, b) => b.year - a.year)
  const newest = withYear[0]
  if (!newest) return []

  const rows = newest.sheet.rows
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c).toLowerCase().includes('company')))
  if (headerIndex === -1) return []

  const header = rows[headerIndex].map((c) => String(c))
  const iCompany = columnOf(header, 'Company')
  const iCity = columnOf(header, 'City')
  const iMonth = columnOf(header, 'Month Posted', 'Month')
  const iEffective = columnOf(header, 'Effective Date')
  const iAffected = columnOf(header, 'Workforce Affected', 'Affected')
  if (iCompany === -1) return []

  const out: WarnRow[] = []
  for (const row of rows.slice(headerIndex + 1)) {
    const employer = String(row[iCompany] ?? '').trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue

    const monthName = String(row[iMonth] ?? '').trim().toLowerCase()
    const monthIndex = MONTHS.indexOf(monthName)
    const noticeDate = monthIndex >= 0 ? new Date(Date.UTC(newest.year, monthIndex, 1)) : null

    // The effective date is sometimes a serial, sometimes a written range
    // ("4/10/26 - 11/26/26"); the first date in a range is the one that counts.
    const rawEffective = row[iEffective]
    const effectiveDate =
      excelSerialToDate(rawEffective as string | number) ??
      parseDate(String(rawEffective ?? '').split(/\s*[-–]\s*/)[0])

    out.push({
      state: 'NJ',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate,
      effectiveDate,
      employees: parseCount(String(row[iAffected] ?? '')),
      layoffType: null,
      county: null,
      address: iCity >= 0 ? String(row[iCity] ?? '').trim() || null : null,
      industry: null,
    })
  }
  return out
}

/**
 * Mississippi publishes a PDF per quarter rather than a page of notices.
 *
 * Worth the PDF handling because the table is unusually complete: it carries a
 * full NAICS code and description alongside the headcount, which puts
 * Mississippi in the small group of states whose notices can promote
 * themselves.
 *
 * The extracted text separates cells with font artifacts rather than anything
 * structural, so records are found by self-synchronizing on their shape — a
 * date followed five cells later by an RR-MS event number — instead of
 * trusting a fixed offset. A layout change then yields no records rather than
 * eleven fields read one column out of step.
 */
export const MISSISSIPPI_PAGE = 'https://mdes.ms.gov/warn/'

const MS_FIELDS = 11

export function resolveMississippiPdf(pageHtml: string): string | null {
  const links = [...pageHtml.matchAll(/href="([^"]*warn-py(\d{4})-qtr-(\d)[^"]*\.pdf)"/gi)]
  if (!links.length) return null
  // Newest program year, then newest quarter within it.
  const best = links
    .map((m) => ({ href: m[1], year: parseInt(m[2], 10), quarter: parseInt(m[3], 10) }))
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter)[0]
  return best.href.startsWith('http') ? best.href : `https://mdes.ms.gov${best.href}`
}

/** Every quarterly PDF the page links, newest first: a 12-month window spans five of them (the new program year and the last one). */
export function resolveMississippiPdfs(pageHtml: string): string[] {
  const seen = new Set<string>()
  const links = [...pageHtml.matchAll(/href="([^"]*warn-py(\d{4})-(?:qtr-|q)(\d)[^"]*\.pdf)"/gi)]
    .map((m) => ({ href: m[1], year: parseInt(m[2], 10), quarter: parseInt(m[3], 10) }))
    .filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)))
    .sort((a, b) => b.year - a.year || b.quarter - a.quarter)
  return links.slice(0, 5).map((l) => (l.href.startsWith('http') ? l.href : `https://mdes.ms.gov${l.href}`))
}

export function parseMississippiWarn(text: string): WarnRow[] {
  const cells = text
    .split(/Í[^®]{0,4}®/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const isDate = (v: string | undefined) => !!v && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)
  const isEvent = (v: string | undefined) => !!v && /^RR-[A-Z]{2}-\d{4}-\d{4}$/.test(v)

  const out: WarnRow[] = []
  for (let i = 0; i < cells.length; i++) {
    if (!isDate(cells[i]) || !isEvent(cells[i + 5])) continue

    const [noticeDate, employer, city, county, , , naics, action, affected, actionDate, reason] =
      cells.slice(i, i + MS_FIELDS)
    if (!employer) continue

    out.push({
      state: 'MS',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(noticeDate),
      effectiveDate: parseDate(actionDate),
      employees: parseCount(affected),
      layoffType: [action, reason].filter(Boolean).join(' — ') || null,
      county: county || null,
      address: city || null,
      // "622110 – General Medical and Surgical Hospital"; the sector filter
      // reads the leading two digits.
      industry: normalizeIndustry(naics?.match(/^\d{6}/)?.[0] ?? null, 'MS'),
    })
    i += MS_FIELDS - 1
  }
  return out
}

/**
 * Iowa keeps a "WARN Log" workbook, one sheet per year, linked from its
 * employer resources page. The link is a numbered media path rather than a
 * filename, so it is resolved from the page instead of hard-coded.
 *
 * The header does not sit on the first row — the sheet opens with a title and
 * an "Updated:" stamp — so it is located by content.
 */
export const IOWA_PAGE = 'https://workforce.iowa.gov/employers/resources/warn'

export function resolveIowaFile(pageHtml: string): string | null {
  const href = pageHtml.match(/href="([^"]*\/media\/\d+\/download[^"]*)"/i)?.[1]
  if (!href) return null
  return href.startsWith('http') ? href : `https://workforce.iowa.gov${href}`
}

export function parseIowaWarn(sheets: { name: string; rows: (string | number)[][] }[]): WarnRow[] {
  const withYear = sheets
    .map((sheet) => ({ sheet, year: parseInt(sheet.name.match(/(20\d{2})/)?.[1] ?? '', 10) }))
    .filter((s) => Number.isFinite(s.year))
    .sort((a, b) => b.year - a.year)
  const newest = withYear[0]
  if (!newest) return []

  const rows = newest.sheet.rows
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === 'company'))
  if (headerIndex === -1) return []

  const header = rows[headerIndex].map((c) => String(c))
  const iCompany = columnOf(header, 'Company')
  const iCity = columnOf(header, 'City')
  const iCounty = columnOf(header, 'County')
  const iType = columnOf(header, 'Notice Type')
  const iCount = columnOf(header, 'Emp #', 'Emp')
  const iDate = columnOf(header, 'Notice Date')
  if (iCompany === -1) return []

  const out: WarnRow[] = []
  for (const row of rows.slice(headerIndex + 1)) {
    const employer = String(row[iCompany] ?? '').trim()
    if (!employer || HEADER_WORDS.has(employer.toLowerCase())) continue
    out.push({
      state: 'IA',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: excelSerialToDate(row[iDate] as string | number) ?? parseDate(String(row[iDate] ?? '')),
      effectiveDate: null,
      employees: parseCount(String(row[iCount] ?? '')),
      layoffType: iType >= 0 ? String(row[iType] ?? '').trim() || null : null,
      county: iCounty >= 0 ? String(row[iCounty] ?? '').trim() || null : null,
      address: iCity >= 0 ? String(row[iCity] ?? '').trim() || null : null,
      industry: null,
    })
  }
  return out
}


/**
 * Louisiana posts one PDF per year, https://www.laworks.net/Downloads/WFD/WarnNotices<year>.pdf, updated as notices arrive: company,
 * address, notice date, layoff date, employees affected, industry. A name, address or industry wraps over two or three lines, so
 * the rows are rebuilt by position (pdf-table.ts), not by the order the text comes in.
 */
export const louisianaPdf = (year: number) => `https://www.laworks.net/Downloads/WFD/WarnNotices${year}.pdf`

const LA_COLUMNS: ColumnSpec[] = [
  { key: 'company', header: /^Company Name$/ }, { key: 'address', header: /^Address$/ }, { key: 'notice', header: /^Notice$/ },
  { key: 'layoff', header: /^Layoff$/ }, { key: 'employees', header: /^Employees$/ }, { key: 'industry', header: /^Industry$/ },
]
// The 2025 file has no Address column: the address sits under the company name in the same column.
const LA_COLUMNS_NO_ADDRESS = LA_COLUMNS.filter((c) => c.key !== 'address')

const oneLine = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim()

export function parseLouisianaItems(pages: PdfItem[][]): WarnRow[] {
  const out: WarnRow[] = []
  let edges: ColumnEdges | undefined
  let hasAddressColumn = true
  for (const items of pages) {
    // A table that runs onto a second page does not repeat its header: that page reads with the first page's columns.
    const hasHeader = items.some((i) => /^Company Name$/.test(i.s))
    if (hasHeader) {
      hasAddressColumn = items.some((i) => /^Address$/.test(i.s))
      edges = columnEdges(items, hasAddressColumn ? LA_COLUMNS : LA_COLUMNS_NO_ADDRESS)
    }
    if (!edges) continue
    for (const r of pdfTableRows(items, hasAddressColumn ? LA_COLUMNS : LA_COLUMNS_NO_ADDRESS, 'notice', hasHeader ? undefined : edges)) {
      let company = r.company
      let address = r.address
      if (!hasAddressColumn) {
        // Name lines first, then the street line (it starts with a number, or a bracket and a number) and the city under it.
        const lines = (r.company ?? '').split('\n')
        const street = lines.findIndex((l, i) => i > 0 && /^\(?\d/.test(l))
        company = (street > 0 ? lines.slice(0, street) : lines).join(' ')
        address = street > 0 ? lines.slice(street).join(' ') : ''
      }
      company = oneLine(company)
      if (!company) continue
      out.push({
        state: 'LA',
        employer: company,
        normalizedEmployer: normalizeOrgName(company),
        noticeDate: parseDate(oneLine(r.notice)),
        effectiveDate: parseDate(oneLine(r.layoff)),
        employees: parseCount(oneLine(r.employees)),
        layoffType: null,
        county: null,
        address: oneLine(address) || null,
        industry: normalizeIndustry(oneLine(r.industry) || null, 'LA'),
      })
    }
  }
  return out
}

export async function parseLouisianaWarn(buf: Buffer): Promise<WarnRow[]> {
  const rows = parseLouisianaItems(await pdfPages(buf))
  if (!rows.length) throw new Error('LA: the WARN PDF produced no rows; its layout has changed')
  return rows
}

/**
 * New Mexico (Department of Workforce Solutions, now dws.nm.gov) posts one PDF per year, linked from its Rapid Response page:
 * notice date, job site name, county, workforce area, total layoff, layoff date, received date, city. One line a row.
 */
export const NEW_MEXICO_PAGE = 'https://www.dws.nm.gov/Rapid-Response'

export function resolveNewMexicoPdfs(pageHtml: string): string[] {
  const found = [...pageHtml.matchAll(/href="([^"]*?(20\d{2})_WARN[^"]*\.pdf)"/gi)].map((m) => ({ year: parseInt(m[2], 10), href: m[1] }))
  const byYear = new Map<number, string>()
  for (const f of found) if (!byYear.has(f.year)) byYear.set(f.year, f.href)
  // This year's and last year's: a 12-month window reaches back into the previous file until the new year is well along.
  return [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, href]) => (href.startsWith('http') ? href : new URL(href, 'https://www.dws.nm.gov').toString()))
}

const NM_COLUMNS: ColumnSpec[] = [
  { key: 'notice', header: /^NOTICE DATE$/i }, { key: 'site', header: /^JOB SITE NAME$/i }, { key: 'county', header: /^COUNTY NAME$/i },
  { key: 'wda', header: /^WDA NAME$/i }, { key: 'total', header: /^TOTAL LAYOFF$/i }, { key: 'layoff', header: /^LAYOFF DATE$/i },
  { key: 'received', header: /^RECEIVED DATE$/i }, { key: 'city', header: /^CITY NAME$/i },
]

export function parseNewMexicoItems(pages: PdfItem[][]): WarnRow[] {
  const out: WarnRow[] = []
  let edges: ColumnEdges | undefined
  for (const items of pages) {
    const hasHeader = items.some((i) => /^JOB SITE NAME$/i.test(i.s))
    if (hasHeader) edges = columnEdges(items, NM_COLUMNS)
    if (!edges) continue
    for (const r of pdfTableRows(items, NM_COLUMNS, 'notice', hasHeader ? undefined : edges)) {
      const site = oneLine(r.site)
      if (!site) continue
      out.push({
        state: 'NM',
        employer: site,
        normalizedEmployer: normalizeOrgName(site),
        noticeDate: parseDate(oneLine(r.notice)),
        effectiveDate: parseDate(oneLine(r.layoff)),
        employees: parseCount(oneLine(r.total)),
        layoffType: null,
        county: oneLine(r.county) || null,
        address: oneLine(r.city) || null,
        industry: null,
      })
    }
  }
  return out
}

export async function parseNewMexicoWarn(buf: Buffer): Promise<WarnRow[]> {
  const rows = parseNewMexicoItems(await pdfPages(buf))
  if (!rows.length) throw new Error('NM: the WARN PDF produced no rows; its layout has changed')
  return rows
}

/**
 * West Virginia (WorkForce West Virginia) lists one PDF per notice, each linked with the employer and the date in its text
 * ("Greenbrier Minerals WARN 2-13-26"). The headcount is only inside each employer's letter, which has no fixed layout, so rows
 * carry the employer and date. A link with no date in its text takes the first of the month it was uploaded in (the file's path).
 */
export const WEST_VIRGINIA_PAGE = 'https://workforcewv.org/job-seeker/layoffs-downsizing/warn-listing/'

export function parseWestVirginiaWarn(html: string): WarnRow[] {
  const out: WarnRow[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]*\/wp-content\/uploads\/(\d{4})\/(\d{2})\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, year, month, inner] = m
    const text = stripTags(inner).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
    // The list's own file ("Download Warn Notice PDF") and attachments are not notices.
    if (!/warn/i.test(`${text} ${href}`) || /^download|occupations/i.test(text)) continue
    const dateText = text.match(/(\d{1,2})[-/_](\d{1,2})[-/_](\d{2,4})/)
    let noticeDate: Date | null = null
    if (dateText) {
      const y = dateText[3].length === 2 ? 2000 + parseInt(dateText[3], 10) : parseInt(dateText[3], 10)
      const d = new Date(Date.UTC(y, parseInt(dateText[1], 10) - 1, parseInt(dateText[2], 10)))
      if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() === y) noticeDate = d
    }
    noticeDate ??= new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1))
    const employer = text
      .replace(/(\d{1,2})[-/_](\d{1,2})[-/_](\d{2,4})/g, ' ')
      .replace(/\b(warn|notice|state|update|received|supplemental|revised|pdf)\b/gi, ' ')
      .replace(/\b(r\d|\d{5,6})\b/g, ' ')
      .replace(/\b\d{1,2}[-/]\d{4}\b/g, ' ')
      .replace(/\s(january|february|march|april|may|june|july|august|september|october|november|december)\s*$/i, ' ')
      .replace(/^[\s–-]+|[\s–-]+$/g, '')
      .replace(/^west virginia\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (employer.length < 2) continue
    const key = `${employer.toLowerCase()}|${noticeDate.toISOString().slice(0, 10)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      state: 'WV',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate,
      effectiveDate: null,
      employees: null,
      layoffType: null,
      county: null,
      address: null,
      industry: null,
    })
  }
  return out
}

/**
 * Nevada (Department of Employment, Training and Rehabilitation) posts "WARN and Non-WARN Master", one PDF for the year, at
 * https://detr.nv.gov/content/media/WARN_and_Non_WARN_Master_w_Logo.pdf: received date, effective date, layoff or closure,
 * total affected, employer, city, county, and whether it was a WARN or a Non-WARN (voluntary) notice. Only WARN notices are
 * kept. The site refuses scripted requests (Akamai) but serves the file to a person's browser, so it is read from a file
 * saved by hand: see FILE_STATES.
 *
 * The headers are centred over wide columns, so the column starts are fixed here rather than read from the header.
 */
const NV_COLUMNS = fixedEdges([
  { key: 'received', from: 0 }, { key: 'effective', from: 80 }, { key: 'type', from: 125 }, { key: 'affected', from: 160 },
  { key: 'employer', from: 205 }, { key: 'city', from: 380 }, { key: 'county', from: 430 }, { key: 'notification', from: 490 },
])

export function parseNevadaItems(pages: PdfItem[][]): WarnRow[] {
  const out: WarnRow[] = []
  for (const items of pages) {
    const header = items.find((i) => /^Employer$/.test(i.s))
    if (!header) continue
    // Rows start below the header's three lines: the first dated row is the highest data line.
    const dates = items.filter((i) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.s) && i.x < 80)
    if (!dates.length) continue
    const firstRowY = Math.max(...dates.map((d) => d.y))
    for (const r of pdfTableRows(items, [], 'received', NV_COLUMNS, { dataTop: firstRowY + 4 })) {
      const employer = oneLine(r.employer)
      if (!employer || !/^WARN$/i.test(oneLine(r.notification))) continue
      const type = oneLine(r.type)
      out.push({
        state: 'NV',
        employer,
        normalizedEmployer: normalizeOrgName(employer),
        noticeDate: parseDate(oneLine(r.received)),
        effectiveDate: parseDate(oneLine(r.effective)),
        employees: parseCount(oneLine(r.affected)),
        layoffType: /closure/i.test(type) ? 'Closure' : /layoff/i.test(type) ? 'Layoff' : null,
        county: oneLine(r.county) || null,
        address: oneLine(r.city) || null,
        industry: null,
      })
    }
  }
  return out
}

export async function parseNevadaWarn(buf: Buffer): Promise<WarnRow[]> {
  const rows = parseNevadaItems(await pdfPages(buf))
  if (!rows.length) throw new Error('NV: the WARN PDF produced no WARN rows; its layout has changed')
  return rows
}

/**
 * Minnesota (DEED) lists each notice as a line "Employer - M/D/YYYY" linking to the employer's letter, at
 * https://mn.gov/deed/business/layoff-resources/. No headcount or place. Its site sits behind a bot check that refuses scripts but
 * not a person's browser, so the lines are copied from a real browser and read with importFileState (see FILE_STATES). A
 * "(Revision)" line updates a notice already listed, so it is skipped.
 */
export function parseMinnesotaList(text: string): WarnRow[] {
  const out: WarnRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^(.{2,120}?)\s+-\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/)
    if (!m || /\(revision/i.test(m[1])) continue
    const employer = m[1].trim()
    out.push({
      state: 'MN',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate: parseDate(m[2]),
      effectiveDate: null,
      employees: null,
      layoffType: null,
      county: null,
      address: null,
      industry: null,
    })
  }
  return out
}

/**
 * Hawaii's Workforce Development Division lists the current notices on one page, each a link "Employer (what) – Month D, YYYY" to
 * the notice's own page. The older notices sit on the Workforce Development Council's yearly pages, which the daily scraped-states job
 * already reads; that job stopped at 31 July 2026, so this reads the current page. No headcount on the list.
 */
export const HAWAII_PAGE = 'https://labor.hawaii.gov/wdd/warn-notices/'

export function parseHawaiiWarn(html: string): WarnRow[] {
  const out: WarnRow[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\s[^>]*href="[^"]*\/wdd\/warn-notices\/warn-notice-[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[1]).replace(/\s+/g, ' ').trim()
    const split = text.match(/^(.*\S)\s+[–—-]\s+([A-Z][a-z]+ \d{1,2}, \d{4})$/)
    if (!split) continue
    // "Hawaiian Airlines – Non-Union Workforce Reduction (Alaska Air Group merger)": the parenthesis says why, not who.
    const employer = split[1].replace(/\s*\([^)]*\)\s*$/, '').trim()
    const noticeDate = parseDate(split[2])
    if (employer.length < 2 || !noticeDate) continue
    const key = `${employer.toLowerCase()}|${noticeDate.toISOString().slice(0, 10)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      state: 'HI',
      employer,
      normalizedEmployer: normalizeOrgName(employer),
      noticeDate,
      effectiveDate: null,
      employees: null,
      layoffType: null,
      county: null,
      address: null,
      industry: null,
    })
  }
  return out
}

/**
 * Kentucky (Kentucky Career Center, now at kyworks.ky.gov) posts a "WARN Notice Report" workbook for the current year and a "Prior Year
 * Warn Notices" workbook with a sheet per year, both linked from its Rapid Response page. A row has the date received, the workforce
 * board, county, company, a full NAICS code, the headcount, closure or layoff and the projected date. The two files differ a little:
 * the current one names its columns ("Company: Company Name"), the prior one leaves the county and company headers blank and puts the
 * dates in text. The daily Big Local News scraper had these two dates swapped, so Kentucky's notices showed as filed months after
 * they were.
 */
export const KENTUCKY_PAGE = 'https://kyworks.ky.gov/Services/Pages/Rapid-Response-Layoffs-and-Closures.aspx'

export function resolveKentuckyFiles(pageHtml: string): { current: string | null; prior: string | null } {
  let current: string | null = null
  let prior: string | null = null
  for (const m of pageHtml.matchAll(/<a\s[^>]*href="([^"]+\.xlsx?)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[2]).replace(/\s+/g, ' ').trim()
    const href = m[1].startsWith('http') ? m[1] : new URL(m[1], 'https://kyworks.ky.gov').toString()
    if (/prior year/i.test(text)) prior ??= href
    else if (/warn notice report/i.test(text)) current ??= href
  }
  return { current, prior }
}

export function parseKentuckyWorkbook(sheets: XlsxSheet[]): WarnRow[] {
  const out: WarnRow[] = []
  const date = (v: string | undefined): Date | null => {
    const t = (v ?? '').trim()
    if (!t) return null
    return /[/-]/.test(t) ? parseDate(t) : excelSerialToDate(t)
  }
  for (const sheet of sheets) {
    const h = sheet.rows.findIndex((r) => r.some((c) => /^date received$/i.test(String(c ?? '').trim())))
    if (h === -1) continue
    const header = sheet.rows[h].map((c) => String(c ?? ''))
    const iDate = columnOf(header, 'Date Received')
    const iCounty = columnOf(header, 'County') >= 0 ? columnOf(header, 'County') : 2
    // The prior-year sheets leave the company column's header blank (it sits right after the county).
    const iCompany = columnOf(header, 'Company Name', 'Company') >= 0 ? columnOf(header, 'Company Name', 'Company') : 3
    const iNaics = columnOf(header, 'NAICS Code', 'NAICS')
    const iCount = columnOf(header, 'Number of Employees Affected', 'Employees')
    const iType = columnOf(header, 'Closure or Layoff')
    const iProjected = columnOf(header, 'Projected Date')
    for (const row of sheet.rows.slice(h + 1)) {
      const employer = String(row[iCompany] ?? '').replace(/\s+/g, ' ').trim()
      const noticeDate = date(row[iDate])
      if (!employer || !noticeDate) continue
      const type = String(row[iType] ?? '')
      out.push({
        state: 'KY',
        employer,
        normalizedEmployer: normalizeOrgName(employer),
        noticeDate,
        effectiveDate: iProjected >= 0 ? date(row[iProjected]) : null,
        employees: parseCount(String(row[iCount] ?? '')),
        layoffType: /closure/i.test(type) ? 'Closure' : /layoff/i.test(type) ? 'Layoff' : null,
        county: String(row[iCounty] ?? '').replace(/\s+/g, ' ').trim() || null,
        address: null,
        industry: normalizeIndustry(String(row[iNaics] ?? '').trim() || null, 'KY'),
      })
    }
  }
  return out
}

/**
 * South Carolina (SC Works) posts one PDF per year, "<year> South Carolina WARN_Report <MMDDYYYY>.pdf", linked from its layoff
 * notification page, with a new file each time it is updated (the date in the name). Company, county, notice date, layoff or closure
 * date, number impacted, kind, address. The daily Big Local News scraper stored the layoff date as the notice date for several
 * notices (a notice on 9/1/2026 for a layoff on 10/31/2026 showed as filed 10/31), so the file is read directly.
 */
export const SOUTH_CAROLINA_PAGE = 'https://scworks.org/employer/employer-programs/risk-closing/layoff-notification-reports'

/** The newest file of each of the last two years, newest year first. */
export function resolveSouthCarolinaPdfs(pageHtml: string): string[] {
  const best = new Map<number, { stamp: number; href: string }>()
  for (const m of pageHtml.matchAll(/href="([^"]*?(20\d{2})(?:%20|\+| )South(?:%20|\+| )Carolina(?:%20|\+| )WARN_Report(?:%20|\+| )(\d{2})(\d{2})(\d{4})\.pdf)"/gi)) {
    const year = parseInt(m[2], 10)
    const stamp = parseInt(`${m[5]}${m[3]}${m[4]}`, 10) // YYYYMMDD from MMDDYYYY
    if (!best.has(year) || stamp > best.get(year)!.stamp) best.set(year, { stamp, href: m[1] })
  }
  return [...best.entries()].sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, v]) => (v.href.startsWith('http') ? v.href : new URL(v.href, 'https://scworks.org').toString()))
}

/** Column starts on the 2026 file's page; the 2025 file is the same table on a wider page, so they scale with the Address header. */
const SC_BASE = [{ key: 'company', from: 0 }, { key: 'county', from: 200 }, { key: 'notice', from: 260 }, { key: 'layoff', from: 320 },
  { key: 'impacted', from: 420 }, { key: 'kind', from: 470 }, { key: 'address', from: 540 }]
const SC_ADDRESS_HEADER_X = 648

export function parseSouthCarolinaItems(pages: PdfItem[][]): WarnRow[] {
  const out: WarnRow[] = []
  let scale = 1
  for (const items of pages) {
    const address = items.find((i) => /^Address$/.test(i.s))
    if (address) scale = address.x / SC_ADDRESS_HEADER_X
    const edges = fixedEdges(SC_BASE.map((c) => ({ key: c.key, from: c.from * scale })))
    const anchors = items.filter((i) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.s) && i.x >= 260 * scale && i.x < 320 * scale)
    if (!anchors.length) continue
    const firstRowY = Math.max(...anchors.map((a) => a.y))
    for (const r of pdfTableRows(items, [], 'notice', edges, { dataTop: firstRowY + 6, maxWrap: 16 })) {
      const employer = oneLine(r.company)
      if (!employer) continue
      const kind = oneLine(r.kind)
      out.push({
        state: 'SC',
        employer,
        normalizedEmployer: normalizeOrgName(employer),
        noticeDate: parseDate(oneLine(r.notice)),
        // "5/1/2026 - 12/31/2026": the first date is when it starts.
        effectiveDate: parseDate(oneLine(r.layoff).split(/\s+-\s+/)[0]),
        employees: parseCount(oneLine(r.impacted)),
        layoffType: /closure/i.test(kind) ? 'Closure' : /layoff/i.test(kind) ? 'Layoff' : null,
        county: oneLine(r.county) || null,
        address: oneLine(r.address) || null,
        industry: null,
      })
    }
  }
  return out
}

export async function parseSouthCarolinaWarn(buf: Buffer): Promise<WarnRow[]> {
  const rows = parseSouthCarolinaItems(await pdfPages(buf))
  if (!rows.length) throw new Error('SC: the WARN PDF produced no rows; its layout has changed')
  return rows
}

/**
 * Georgia's list (rendered by the browser job) has only the company, the date submitted and the number affected; the county,
 * address, NAICS code, first date of separation and kind of layoff are on each entry's own page, which a script can read. Without
 * the county a notice cannot be tied to a workforce board, so the newest are enriched when they are staged.
 */
export interface GeorgiaRow extends WarnRow { entryUrl: string | null }

export function parseGeorgiaGrid(html: string): GeorgiaRow[] {
  const out: GeorgiaRow[] = []
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1])
    if (tds.length < 4) continue
    const link = tds[0].match(/href="([^"]*\/warn-public-view\/entry\/\d+\/?)"/i)?.[1] ?? null
    const company = stripTags(tds[1]).replace(/\s+/g, ' ').trim()
    const noticeDate = parseDate(stripTags(tds[2]).trim())
    if (!company || company.length < 2 || !noticeDate) continue
    out.push({
      state: 'GA', employer: company, normalizedEmployer: normalizeOrgName(company), noticeDate, effectiveDate: null,
      employees: parseCount(stripTags(tds[3])), layoffType: null, county: null, address: null, industry: null, entryUrl: link,
    })
  }
  return out
}

/** The fields on one Georgia entry page. */
export function parseGeorgiaEntry(html: string): { county: string | null; address: string | null; naics: string | null; separation: Date | null; kind: string | null } {
  const text = stripTags(html.replace(/<\/(?:td|th|div|p|li|dt|dd|tr)>/gi, '|')).replace(/\s+/g, ' ')
  const field = (label: string): string | null => {
    const m = text.match(new RegExp(`(?:^|\\|)\\s*${label}\\s*\\|\\s*([^|]*)`, 'i'))
    return m?.[1]?.trim() || null
  }
  const county = field('County')?.replace(/\s+County$/i, '') ?? null
  const city = text.match(/Company Address\s*\|?\s*([^|]*)\|?\s*([^|]*?)\s*\|?\s*Map It/i)
  const address = city ? [city[1], city[2]].map((x) => x.trim()).filter(Boolean).join(', ') || null : null
  const kind = field('Type of Layoff or Closure')
  return { county, address, naics: field('NAICS'), separation: parseDate(field('First Date of Separation')), kind: kind ? (/closure/i.test(kind) ? 'Closure' : /layoff|reduction/i.test(kind) ? 'Layoff' : kind) : null }
}

/** Fills the county, address, industry, separation date and kind from each entry page, newest first, up to `max` requests. */
export async function enrichGeorgia(rows: GeorgiaRow[], max = Number(process.env.WARN_ENRICH_MAX) || 40): Promise<GeorgiaRow[]> {
  const cutoff = Date.now() - 540 * 86_400_000
  let budget = max
  for (const row of rows) {
    if (budget <= 0) break
    if (!row.entryUrl || row.county || (row.noticeDate && row.noticeDate.getTime() < cutoff)) continue
    budget--
    await new Promise((r) => setTimeout(r, 250))
    try {
      const res = await fetch(row.entryUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' }, signal: AbortSignal.timeout(30_000) })
      if (!res.ok) continue
      const e = parseGeorgiaEntry(await res.text())
      row.county = e.county
      row.address = e.address
      row.effectiveDate = e.separation
      row.layoffType = e.kind
      row.industry = normalizeIndustry(e.naics, 'GA')
    } catch {
      // A page that will not load leaves the row as the list gave it.
    }
  }
  return rows
}
