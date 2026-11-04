const SITE = 'https://launchyournextchapter.com'
import { employerSlug } from './layoff-pages'

/** Wording that rotates so the several posts a day do not read the same. Each list is picked from independently, by a hash of the seed. */
const HELP = [
  'If you or someone you know is affected, NextChapter wants to help them get back to work fast.',
  'NextChapter has lots of great jobs. If you or someone you know is affected, we want to help them find the next one.',
  'If you or someone you know is affected, NextChapter can help them find new skills and get back to work.',
  'If this hits close to home, NextChapter is here to help you or someone you know get back to work fast.',
  'NextChapter helps people find great jobs and build new skills after a layoff. If you or someone you know is affected, we’re here.',
]
const START = [
  'It’s free, start your #nextchapter here:',
  'It’s free to start your #nextchapter here:',
  'Free to use. Start your #nextchapter here:',
]
const TAG = [
  'Being laid off is really tough, so tag someone we can help with their job transition.',
  'Know someone affected? Tag them so we can help with their job transition.',
  'Layoffs are hard. Tag someone we can help with their next step.',
  'Tag a friend or former colleague who could use help with their job transition.',
]

const pick = <T,>(list: T[], seed: string, salt: number): T => {
  let h = salt
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

/** The LinkedIn message for a layoff, with the public page's link, ready to copy. The seed (the notice id) keeps one layoff's wording stable and varies it between layoffs. */
export function linkedinLayoffPost(s: { url: string; employer: string; employees: number | null; state: string | null; seed?: string }): string {
  const cuts = s.employees ? `${s.employees.toLocaleString('en-US')} jobs` : 'jobs'
  const where = s.state ? ` in ${s.state}` : ''
  const seed = s.seed ?? s.employer
  return `${s.employer} is cutting ${cuts}${where}. ${pick(HELP, seed, 1)}\n\n${pick(START, seed, 2)} ${s.url}\n\n${pick(TAG, seed, 3)}\n\n${s.employer}`
}

/** The subject line for the direct message. */
export const linkedinCandidateSubject = (employer: string) => `Your NextChapter after ${employer}`

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
    linkedin: linkedinLayoffPost({ url: `${SITE}/layoffs/company/${employerSlug(n.employer, n.companyName ?? null)}`, employer, employees: n.employees, state: n.state, seed: n.noticeId }),
  }
}
