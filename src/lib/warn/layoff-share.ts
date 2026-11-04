const SITE = 'https://launchyournextchapter.com'
import { employerSlug } from './layoff-pages'

/** The LinkedIn message for a layoff, with the public page's link, ready to copy. */
export function linkedinLayoffPost(s: { url: string; employer: string; employees: number | null; state: string | null }): string {
  const cuts = s.employees ? `${s.employees.toLocaleString('en-US')} jobs` : 'jobs'
  const where = s.state ? ` in ${s.state}` : ''
  return `${s.employer} is cutting ${cuts}${where}. If you or someone you know is affected, NextChapter wants to help them get back in business fast.\n\nIt's free, start your #nextchapter here: ${s.url}\n\n${s.employer}`
}

/** The admin notice page and the LinkedIn message for a layoff, for the alert emails. */
export function noticeShare(n: { noticeId: string; employer: string; companyName?: string | null; employees: number | null; state: string | null }): { noticePage: string; linkedin: string } {
  const employer = n.companyName ?? n.employer
  return {
    noticePage: `${SITE}/support/admin/crm/warn/${n.noticeId}`,
    linkedin: linkedinLayoffPost({ url: `${SITE}/layoffs/company/${employerSlug(n.employer, n.companyName ?? null)}`, employer, employees: n.employees, state: n.state }),
  }
}
