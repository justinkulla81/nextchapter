// What the one ask on a public page says. Every ask names a pain the reader has right now and the payoff they get for clicking,
// in plain words (no "WARN", no "Market Reality Assessment" in the headline). Pure, so the box, the dev preview and the tests share it.
// Owner direction 2026-11-04: "every lead capture needs to be about pain and payoff".

export interface PullCopy {
  /** True for the organization ask (workforce boards, employers, colleges), whose button goes to the contact form. */
  org?: true
  /** The pain, as a question or a flat statement the reader would say about themselves. */
  headline: string
  /** The payoff: what they get, and why we ask for nothing more. One or two short sentences. */
  sentence: string
  /** The button, as the action: "Get my ...", "Start my ...". Null keeps the tested assessment label (src/lib/ab/nav-cta.ts). */
  button: string | null
}

/** The page that follows a layoff: unemployment, severance, health coverage. Pain first, then the deadlines that cost money. */
export const LAID_OFF_COPY: PullCopy = {
  headline: 'Just got laid off? Do not spend week one guessing.',
  sentence: 'Answer a few questions and get a plan that starts with the deadlines that cost people money: filing for unemployment, severance and health coverage. Free. No résumé needed.',
  button: 'Get my laid-off game plan',
}

const PAY_COPY: PullCopy = {
  headline: 'Not sure you are paid what you are worth?',
  sentence: 'See how the market reads your background and which open jobs fit you best. Free. No résumé needed.',
  button: 'Show me what I am worth',
}

const AI_COPY: PullCopy = {
  headline: 'Worried a computer could take your job?',
  sentence: 'See how exposed your kind of work is and the skills that keep you hired, with a plan for the weeks ahead. Free. No résumé needed.',
  button: 'Start my AI-proof plan',
}

/** Anything else: the job search that is not working. The button stays the tested assessment label. */
export const DEFAULT_COPY: PullCopy = {
  headline: 'Applying and hearing nothing back?',
  sentence: 'Find out where you stand: your odds, the jobs that fit you and a plan for the week ahead. Free. No résumé needed.',
  button: null,
}

/** The organization ask. Contract-sold, so the button stays "Talk to us". Claims only what the organization pages already claim: no placement, speed or price wording. */
export const ORG_COPY: PullCopy = {
  org: true,
  headline: 'Hard to reach experienced job seekers where they already look?',
  sentence: 'Get your own page and your own numbers on NextChapter. A short call shows how.',
  button: 'Talk to us',
}

/** The organization ask on layoff pages (rapid response, the WARN tools): a layoff is coming or has hit, and the people affected need somewhere to start. */
export const ORG_LAYOFF_COPY: PullCopy = {
  org: true,
  headline: 'A layoff is coming and the people affected have nowhere to start?',
  sentence: 'Send them one link to a job search plan, local jobs and career support. A short call shows how.',
  button: 'Talk to us',
}

/** The organization copy for a page, chosen from the page's slug (see pullContext). */
export function orgCopyForSlug(slug: string): PullCopy {
  return /^(rapid-response|tools-warn)/.test(slug) ? ORG_LAYOFF_COPY : ORG_COPY
}

const FREE = 'Free. No résumé needed.'
const copy = (headline: string, sentence: string, button: string): PullCopy => ({ headline, sentence: `${sentence} ${FREE}`, button })

/** Pages with their own pain, by path prefix (the longest prefix wins). The tool pages used to end in a second band saying this; the one box says it now. */
const BY_PREFIX: Record<string, PullCopy> = {
  '/tools/job-loss-readiness': copy('Not sure your job is safe?', 'Get a plan for your next move, whether you move now or just want options open.', 'Get my next-move plan'),
  '/tools/layoff-runway': copy('Running out of runway?', 'Get a plan that starts with the deadlines that cost people money.', 'Get my laid-off game plan'),
  '/tools/layoff-deadlines': copy('Missing a deadline can cost you money.', 'Get a plan that starts with the dates that matter, then your job search.', 'Get my laid-off game plan'),
  '/tools/unemployment-estimator': copy('Do not wait to file.', 'Get a plan that starts with the deadlines, then your job search.', 'Start my first-week plan'),
  '/tools/severance-calculator': LAID_OFF_COPY,
  '/tools/ai-job-check': copy('Does that number worry you?', 'See how recruiters read your background and which open jobs fit you best.', 'Show me jobs that fit me'),
  '/tools/pay-check': copy('Not sure you are paid fairly?', 'See which open jobs fit you and what they pay.', 'Show me jobs that fit me'),
  '/tools/salary-converter': copy('Not sure what your title pays?', 'See how the market reads your background and which jobs fit.', 'Show me what I am worth'),
  '/tools/resume-check': copy('Is your résumé getting ignored?', 'See how recruiters read your background, then get every open job ranked for you.', 'Show me how I read'),
  '/tools/resume-job-match': copy('Is your résumé getting ignored?', 'See how recruiters read your background, then get every open job ranked for you.', 'Show me how I read'),
  '/resources/severance-pay': LAID_OFF_COPY,
  '/resources/cobra-aca': LAID_OFF_COPY,
  '/resources/unemployed': LAID_OFF_COPY,
  '/topics/severance': LAID_OFF_COPY,
}

const BY_ROOT: Record<string, PullCopy> = {
  layoffs: LAID_OFF_COPY,
  'unemployment-benefits': LAID_OFF_COPY,
  start: LAID_OFF_COPY,
  salaries: PAY_COPY,
  salary: PAY_COPY,
  'ai-skills': AI_COPY,
  'ai-job-check': AI_COPY,
}

/** The copy for a page: its own by path, else the one for its first folder ("/layoffs/this-week" reads "layoffs"), else the default. */
export function pullCopyFor(path: string): PullCopy {
  const clean = path.split('?')[0].replace(/\/$/, '')
  const own = Object.keys(BY_PREFIX).filter((k) => clean === k || clean.startsWith(`${k}/`)).sort((x, y) => y.length - x.length)[0]
  if (own) return BY_PREFIX[own]
  const root = clean.split('/').filter(Boolean)[0] ?? ''
  return BY_ROOT[root] ?? DEFAULT_COPY
}
