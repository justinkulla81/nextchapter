const SITE = 'https://launchyournextchapter.com'
import { employerSlug } from './layoff-pages'

/** The LinkedIn message for a layoff, with the public page's link, ready to copy. */
export function linkedinLayoffPost(s: { url: string; employer: string; employees: number | null; state: string | null }): string {
  const cuts = s.employees ? `${s.employees.toLocaleString('en-US')} jobs` : 'jobs'
  const where = s.state ? ` in ${s.state}` : ''
  return `${s.employer} is cutting ${cuts}${where}. If you or someone you know is affected, NextChapter wants to help them get back in business fast.\n\nIt's free, start your #nextchapter here: ${s.url}\n\n${s.employer}`
}

/** The direct message to someone just laid off, from the founder. "Hi [first name]" is filled in by hand when it is sent. */
export function linkedinCandidateNote(s: { url: string; employer: string }): string {
  return `Hi [first name],

I’m Justin, founder of NextChapter. I saw the news about the ${s.employer} layoffs and I’m really sorry.

I started NextChapter, the first job transition platform for professionals, for exactly this reason. It’s free for candidates, and it’s built to help people get back to work fast. Here is the page for those affected by the ${s.employer} layoffs - feel free to share with others too. ${s.url}

We're a new company, so your feedback is welcome - our goal is to be as helpful as possible getting people back to work. We're here to help!

Best,
Justin`
}

/** The admin notice page and the LinkedIn message for a layoff, for the alert emails. */
export function noticeShare(n: { noticeId: string; employer: string; companyName?: string | null; employees: number | null; state: string | null }): { noticePage: string; linkedin: string } {
  const employer = n.companyName ?? n.employer
  return {
    noticePage: `${SITE}/support/admin/crm/warn/${n.noticeId}`,
    linkedin: linkedinLayoffPost({ url: `${SITE}/layoffs/company/${employerSlug(n.employer, n.companyName ?? null)}`, employer, employees: n.employees, state: n.state }),
  }
}
