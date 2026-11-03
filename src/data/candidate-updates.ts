// What we added or changed that members (job seekers) would care about. The
// monthly "Product updates for members" email is drafted from this list, then
// you approve it before anything sends. Employer, recruiter, coach and
// institution changes go in src/data/customer-updates.ts instead.
//
// Add an entry in the same pull request as the change, in plain words about
// what a member can now do. Skip internal work: refactors, admin-only tools,
// data fixes, anything a member would never notice or use. Dates are when it
// went live. Newest first. See docs/mailing-lists.md.

export interface CandidateUpdate {
  /** YYYY-MM-DD, the day it went live. */
  date: string
  /** Short, starts with a verb or the thing: "Check your résumé against a job post". */
  title: string
  /** One or two plain sentences: what it is and why it matters to them. */
  summary: string
  /** Optional link to where they can use it, a full https URL. */
  href?: string
}

export const CANDIDATE_UPDATES: CandidateUpdate[] = [
  {
    date: '2026-11-02',
    title: 'See how your résumé fares for a job title or industry',
    summary: 'Every job-title and industry page now has a skills check: paste your résumé and see which of the skills employers name you already cover, which you are missing, and which AI skills are worth having. It runs in your browser.',
    href: 'https://launchyournextchapter.com/jobs/title/software-engineer',
  },
  {
    date: '2026-11-02',
    title: 'Job outlook, pay and AI use on job-title pages',
    summary: 'Pages for many job titles now show the government\'s 10-year employment outlook, national median pay, openings per year and how much AI is already used in the work, plus the jobs people move into from that role.',
    href: 'https://launchyournextchapter.com/jobs/title/account-executive',
  },
  {
    date: '2026-10-30',
    title: 'Check your résumé against a job description',
    summary: 'Paste a job post and your résumé and see which keywords you are missing. It runs in your browser, so nothing you paste is sent to us.',
    href: 'https://launchyournextchapter.com/tools/resume-job-match',
  },
  {
    date: '2026-10-30',
    title: 'Is my job safe from AI? A free check by job title',
    summary: 'Type your job title to see how much of the work AI already does, which related jobs pay more or are less exposed, and the skills to build.',
    href: 'https://launchyournextchapter.com/tools/ai-job-check',
  },
  {
    date: '2026-10-29',
    title: 'Unemployment benefits for your state, step by step',
    summary: 'Each state page now has the filing steps, a ready-to-file checklist and appeal deadlines, alongside the weekly benefit, how many weeks and how severance counts.',
    href: 'https://launchyournextchapter.com/unemployment-benefits',
  },
  {
    date: '2026-10-29',
    title: 'Sign up without a résumé',
    summary: 'You can now create your account with just your name and email and add a résumé later. Uploading one is still the fastest way to get your personalized report.',
  },
  {
    date: '2026-10-27',
    title: 'See how your pay compares, including the AI-skill premium',
    summary: 'Pick a job title and enter your yearly pay to see where you sit against the pay employers list in current postings: the lower quarter, the median and the upper quarter.',
    href: 'https://launchyournextchapter.com/tools/pay-check',
  },
]
