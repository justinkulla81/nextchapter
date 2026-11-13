// Applicant tracking systems an employer runs its own career site on. A job whose link (its url) is on one of these hosts is on the
// employer's own career system, whichever feed it reached us through: a venture firm's portfolio board that links to
// job-boards.greenhouse.io/<company> is that company's own Greenhouse listing. Owner decision, 2026-11-13: widen the "direct" rule from
// the crawler's directListing flag and the 'employer' source category to these hosts. Pure, so the rule is tested without a database.
//
// Only hosts where each employer has its own board. Not a venture, PE or accelerator board (getro.com and the like), not a job
// aggregator, and not a generic domain (ats.rippling.com, not rippling.com). Add a host here and the sitemap, the page's robots tag and
// the Google and Bing pushes all follow (PUBLIC_JOB_SEARCH_SQL uses EMPLOYER_ATS_SQL_PATTERN).

export const EMPLOYER_ATS_HOSTS = [
  'greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com', 'smartrecruiters.com', 'icims.com', 'jobvite.com', 'workable.com',
  'recruitee.com', 'breezy.hr', 'bamboohr.com', 'taleo.net', 'ultipro.com', 'dayforcehcm.com', 'applytojob.com', 'teamtailor.com',
  'pinpointhq.com', 'personio.com', 'personio.de', 'ats.rippling.com', 'comeet.co', 'workforcenow.adp.com',
] as const

const escapeDots = (h: string) => h.replace(/\./g, '\\.')

/** The same pattern for JavaScript and for Postgres (`url ~* pattern`): http(s), any subdomains, the ATS host, then a port, path, query or the end. */
export const EMPLOYER_ATS_SQL_PATTERN = `^https?://([a-z0-9-]+\\.)*(${EMPLOYER_ATS_HOSTS.map(escapeDots).join('|')})(:[0-9]+)?([/?#]|$)`
const ATS_URL = new RegExp(EMPLOYER_ATS_SQL_PATTERN, 'i')

export function isEmployerAtsUrl(url: string | null | undefined): boolean {
  return !!url && ATS_URL.test(url.trim())
}
