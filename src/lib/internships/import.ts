// One internship from the ncrawl internship stream → an InternshipPosting row,
// or the reason it stays out. Pure (helpers injected), so it is unit-tested.

import { internshipDeadline, internshipTerm, screenInternship, INTERNSHIP_TERMS, type InternshipField, type InternshipTerm } from './fields'

export interface InternshipImportInput {
  title?: unknown
  companyName?: unknown
  url?: unknown
  location?: string | null
  description?: string | null
  department?: string | null
  locationState?: string | null
  remote?: boolean | null
  term?: string | null
  termYear?: number | null
  deadline?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  payPeriod?: string | null
  postedAt?: string | null
  sourceName?: string | null
}

export interface PreparedInternship {
  url: string
  title: string
  companyName: string
  location: string | null
  locationState: string | null
  remote: boolean
  field: InternshipField
  term: InternshipTerm | null
  termYear: number | null
  deadline: Date | null
  description: string | null
  salaryMin: number | null
  salaryMax: number | null
  payPeriod: string | null
  postedAt: string | null
  sourceName: string | null
}

type Helpers = {
  cleanLocation: (l: string | null | undefined) => string | null
  isNonUs: (l: string | null) => boolean
  statesOf: (l: string | null) => { states: string[]; isRemote: boolean }
}

const PERIODS = new Set(['hour', 'week', 'month', 'year'])
const salary = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 2_147_483_647 ? Math.round(n) : null)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function prepareInternship(
  input: InternshipImportInput,
  h: Helpers,
): { keep: true; row: PreparedInternship } | { keep: false; url: string | null; reason: string } {
  const title = str(input.title)
  const companyName = str(input.companyName)
  const url = str(input.url)
  if (!title || !companyName || !url) return { keep: false, url, reason: 'missing required field (title, companyName, or url)' }
  const verdict = screenInternship({ title, description: input.description, department: input.department })
  if (!verdict.keep) return { keep: false, url, reason: verdict.reason }
  const location = h.cleanLocation(input.location)
  if (location && h.isNonUs(location)) return { keep: false, url, reason: 'outside the US' }
  const parts = h.statesOf(location)
  const sentState = str(input.locationState)?.toUpperCase() ?? null
  const sentTerm = str(input.term)
  const read = internshipTerm(title, input.description)
  const term = sentTerm && (INTERNSHIP_TERMS as readonly string[]).includes(sentTerm) ? (sentTerm as InternshipTerm) : read.term
  const sentDeadline = str(input.deadline) ? new Date(input.deadline as string) : null
  const pay = str(input.payPeriod)?.toLowerCase() ?? null
  return {
    keep: true,
    row: {
      url,
      title,
      companyName,
      location,
      locationState: sentState && /^[A-Z]{2}$/.test(sentState) ? sentState : (parts.states[0] ?? null),
      remote: input.remote === true || parts.isRemote || /\bremote\b/i.test(title),
      field: verdict.field,
      term,
      termYear: typeof input.termYear === 'number' && input.termYear >= 2020 && input.termYear <= 2040 ? input.termYear : read.year,
      deadline: sentDeadline && !Number.isNaN(sentDeadline.getTime()) ? sentDeadline : internshipDeadline(input.description),
      description: str(input.description),
      salaryMin: salary(input.salaryMin),
      salaryMax: salary(input.salaryMax),
      payPeriod: pay && PERIODS.has(pay) ? pay : null,
      postedAt: str(input.postedAt),
      sourceName: str(input.sourceName),
    },
  }
}
