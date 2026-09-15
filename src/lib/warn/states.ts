import { normalizeOrgName } from '@/lib/text/org-name-match'
import { readTables, columnOf, parseDate, parseCount, stripTags } from './html'
import { parseCsv } from './csv'
import { excelSerialToDate } from './xlsx'
import type { WarnRow } from './sources'

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
