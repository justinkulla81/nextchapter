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
  parse: (buf: Buffer, url: string) => WarnRow[]
}

/**
 * Only California for now, and deliberately so.
 *
 * Every state publishes WARN differently — some as HTML tables, some as PDFs,
 * a few not machine-readable at all. Adding a state means writing and testing a
 * parser against its real file, and a parser written against a format nobody
 * has looked at is a parser that silently produces wrong rows.
 */
export const WARN_SOURCES: WarnSource[] = [
  {
    state: 'CA',
    url: 'https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx',
    parse: parseCaliforniaWarn,
  },
]
