// The quality gate on the member job board (docs/jobs-report/jooble-footprint-and-plan.md).
// "From employers" (the default) shows jobs listed on the employer's own career site or job system.
// "Employers and recruiters" adds listings from recruiters, search firms and job boards, ranked after
// the employer's own, with a job board's copy hidden when the employer lists the job itself.
// Listings that hide the employer ("Confidential") and junk boards are never shown in either view.
// Pure and client-safe: it reads only the light-row fields (sourceCategory, companyName).

export type SourceView = 'direct' | 'all'
export const SOURCE_VIEWS: SourceView[] = ['direct', 'all']
export const SOURCE_VIEW_LABEL: Record<SourceView, string> = { direct: 'From employers', all: 'Employers and recruiters' }
export const SOURCE_VIEW_HINT: Record<SourceView, string> = {
  direct: 'Jobs listed on the employer’s own career site, so you apply to the employer.',
  all: 'Employer jobs first. Recruiter and job-board listings follow, marked as such.',
}

/** The `source` URL parameter: 'all' shows recruiters and boards too; anything else is From employers. */
export function parseSourceView(v: string | string[] | null | undefined): SourceView {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'all' ? 'all' : 'direct'
}

/** sourceCategory values that are not the employer's own career site: job boards, search firms, portfolio boards. */
const THIRD_PARTY = new Set(['aggregator', 'search_firm', 'venture', 'association', 'women_board', 'board', 'accelerator', 'pe'])

export function isThirdPartySource(sourceCategory: string | null | undefined): boolean {
  return !!sourceCategory && THIRD_PARTY.has(sourceCategory)
}

const HIDDEN_EMPLOYER = /^(confidential|undisclosed|anonymous|stealth|private employer|our client|client of)\b/i
const JUNK_BOARDS = /^(clearancejobs|grabjobs|jobot|talent\.com|jobrapido|adzuna|ziprecruiter|learn4good)\b/i

/** A listing that does not name the employer, or comes from a junk board: never shown. */
export function isJunkListing(p: { companyName: string }): boolean {
  const name = p.companyName.trim()
  return name === '' || HIDDEN_EMPLOYER.test(name) || JUNK_BOARDS.test(name)
}

export function normalizeEmployer(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/\b(inc|llc|ltd|corp|corporation|co|company|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

type Row = { companyName: string; sourceCategory?: string | null }

/**
 * The board keep predicate for a view. `directEmployers` is the set of normalized employer names that
 * have a live employer-listed job: in "Employers and recruiters" a job board's listing for one of them is hidden.
 */
export function sourceKeep(view: SourceView, directEmployers: ReadonlySet<string> | null): (p: Row) => boolean {
  if (view === 'direct') return (p) => !isJunkListing(p) && !isThirdPartySource(p.sourceCategory)
  return (p) => {
    if (isJunkListing(p)) return false
    if (p.sourceCategory === 'aggregator' && directEmployers?.has(normalizeEmployer(p.companyName))) return false
    return true
  }
}

/** Employer-listed jobs rank first in "Employers and recruiters" (a tie-break within a fit level). */
export function isEmployerListed(p: Row): boolean {
  return !isThirdPartySource(p.sourceCategory)
}
