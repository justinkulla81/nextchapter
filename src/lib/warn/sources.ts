import { readXlsx, excelSerialToDate } from './xlsx'
import { normalizeOrgName } from '@/lib/text/org-name-match'

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
  '61', // Educational Services
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
//
// Both would have added steady noise to a pipeline whose whole value is that
// its leads are worth calling.

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

export interface WarnSource {
  state: string
  url: string
  /** 'xlsx' is fetched as bytes; 'json' as text. */
  format: 'xlsx' | 'json'
  parse: (buf: Buffer, url: string) => WarnRow[]
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

/**
 * The states that can actually be synced, and why the obvious ones are missing.
 *
 * Every state publishes WARN differently, and a parser written against a
 * format nobody has looked at silently produces wrong rows. What was checked:
 *
 *   CA — xlsx with headcount AND sector. The best source there is.
 *   TX — Socrata JSON API with headcount, no sector. Stages for review.
 *   NY — NOT INCLUDED. Its current notices live in a Tableau dashboard with no
 *        data endpoint, and its legacy HTML table carries neither headcount nor
 *        industry and stops in 2025. Both fields are what make a notice
 *        actionable, so a NY sync would produce rows nobody could triage.
 *        data.ny.gov publishes no WARN dataset at all — that was checked.
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
]
