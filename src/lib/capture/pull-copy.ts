// What the one ask on a public page says. Every ask names a pain the reader has right now and the payoff they get for clicking,
// in plain words (no "WARN", no "Market Reality Assessment" in the headline). Pure, so the box, the dev preview and the tests share it.
// Owner direction 2026-11-04: "every lead capture needs to be about pain and payoff".

export interface PullCopy {
  /** The pain, as a question or a flat statement the reader would say about themselves. */
  headline: string
  /** The payoff: what they get, and why we ask for nothing more. One or two short sentences. */
  sentence: string
  /** The button, as the action: "Get my ...", "Start my ...". Null keeps the tested assessment label (src/lib/ab/nav-cta.ts). */
  button: string | null
  /** The same page for a signed-in member: the payoff of a fuller profile, in this page's own terms. They never see the registration ask. */
  member: MemberCopy
}

/** The organization ask (workforce boards, employers, colleges); its button goes to the contact form. Members never see this box, so it has no member copy. */
export interface OrgCopy {
  org: true
  headline: string
  sentence: string
  button: string
}

export interface MemberCopy {
  headline: string
  /** Says why a fuller profile changes what this page shows. */
  sentence: string
  /** The action, as a verb phrase. */
  button: string
}

/** Where every member box goes: the page that lists what we use to tailor the site and what would help most. */
export const MEMBER_HREF = '/dashboard/improve'

/** The page that follows a layoff: unemployment, severance, health coverage. Pain first, then the deadlines that cost money. */
export const LAID_OFF_COPY: PullCopy = {
  headline: 'Just got laid off? Do not spend week one guessing.',
  sentence: 'Answer a few questions and get a plan that starts with the deadlines that cost people money: filing for unemployment, severance and health coverage. Free. No résumé needed.',
  button: 'Get my laid-off game plan',
  member: { headline: 'Put your deadlines in order', sentence: 'Your state and last day decide which deadlines come first. Add them and your plan starts with the ones that cost money.', button: 'Improve my plan' },
}

const PAY_COPY: PullCopy = {
  headline: 'Not sure you are paid what you are worth?',
  sentence: 'See how the market reads your background and which open jobs fit you best. Free. No résumé needed.',
  button: 'Show me what I am worth',
  member: { headline: 'See where your pay stands', sentence: 'Your title, location and experience set who you are compared with. Add what is missing and the range fits you.', button: 'Improve my pay check' },
}

const AI_COPY: PullCopy = {
  headline: 'Worried a computer could take your job?',
  sentence: 'See how exposed your kind of work is and the skills that keep you hired, with a plan for the weeks ahead. Free. No résumé needed.',
  button: 'Start my AI-proof plan',
  member: { headline: 'See how exposed your work is', sentence: 'Your skills and tools decide your exposure. Add them and your plan names the skills worth learning first.', button: 'Add my skills' },
}

/** Anything else: the job search that is not working. The button stays the tested assessment label. */
export const DEFAULT_COPY: PullCopy = {
  headline: 'Applying and hearing nothing back?',
  sentence: 'Find out where you stand: your odds, the jobs that fit you and a plan for the week ahead. Free. No résumé needed.',
  button: null,
  member: { headline: 'Tighten your search', sentence: 'Your profile decides why each job ranks where it does. Add what is missing and the list gets closer to the jobs that reply.', button: 'Improve my search' },
}

/** The organization ask. Contract-sold, so the button stays "Talk to us". Claims only what the organization pages already claim: no placement, speed or price wording. */
export const ORG_COPY: OrgCopy = {
  org: true,
  headline: 'Hard to reach experienced job seekers where they already look?',
  sentence: 'Get your own page and your own numbers on NextChapter. A short call shows how.',
  button: 'Talk to us',
}

/** The organization ask on layoff pages (rapid response, the WARN tools): a layoff is coming or has hit, and the people affected need somewhere to start. */
export const ORG_LAYOFF_COPY: OrgCopy = {
  org: true,
  headline: 'A layoff is coming and the people affected have nowhere to start?',
  sentence: 'Send them one link to a job search plan, local jobs and career support. A short call shows how.',
  button: 'Talk to us',
}

/** The organization copy for a page, chosen from the page's slug (see pullContext). */
export function orgCopyForSlug(slug: string): OrgCopy {
  return /^(rapid-response|tools-warn)/.test(slug) ? ORG_LAYOFF_COPY : ORG_COPY
}

const FREE = 'Free. No résumé needed.'
const copy = (headline: string, sentence: string, button: string, member: MemberCopy): PullCopy => ({ headline, sentence: `${sentence} ${FREE}`, button, member })

/** Pages with their own pain, by path prefix (the longest prefix wins). The tool pages used to end in a second band saying this; the one box says it now. */
const BY_PREFIX: Record<string, PullCopy> = {
  '/tools/job-loss-readiness': copy('Not sure your job is safe?', 'Get a plan for your next move, whether you move now or just want options open.', 'Get my next-move plan', { headline: 'Know how safe your job is', sentence: 'Your role, employer and savings set your risk. Add them and the plan fits your timeline.', button: 'Improve my next-move plan' }),
  '/tools/layoff-runway': copy('Running out of runway?', 'Get a plan that starts with the deadlines that cost people money.', 'Get my laid-off game plan', { headline: 'Make the runway yours', sentence: 'Your savings, severance and expenses set how long you have. Add them and the plan starts from your real date.', button: 'Improve my plan' }),
  '/tools/layoff-deadlines': copy('Missing a deadline can cost you money.', 'Get a plan that starts with the dates that matter, then your job search.', 'Get my laid-off game plan', { headline: 'Your dates, not the general ones', sentence: 'Your state and last day set every deadline. Add them and the list shows only yours.', button: 'Improve my plan' }),
  '/tools/unemployment-estimator': copy('Do not wait to file.', 'Get a plan that starts with the deadlines, then your job search.', 'Start my first-week plan', { headline: 'Your state and wages set your benefit', sentence: 'Benefits depend on where you worked and what you earned. Add them and the plan starts with your filing date.', button: 'Improve my plan' }),
  '/tools/severance-calculator': LAID_OFF_COPY,
  '/tools/ai-job-check': copy('Does that number worry you?', 'See how recruiters read your background and which open jobs fit you best.', 'Show me jobs that fit me', { headline: 'Get this check for your own work', sentence: 'Your tasks and tools decide your exposure, not the title alone. Add them and the score is yours.', button: 'Add my skills' }),
  '/tools/pay-check': copy('Not sure you are paid fairly?', 'See which open jobs fit you and what they pay.', 'Show me jobs that fit me', { headline: 'Check pay against your own background', sentence: 'Your experience and location set a fair range. Add what is missing and the open jobs show what they pay you.', button: 'Improve my pay check' }),
  '/tools/salary-converter': copy('Not sure what your title pays?', 'See how the market reads your background and which jobs fit.', 'Show me what I am worth', { headline: 'See what your own title pays', sentence: 'Your title, level and location set the range. Add them and the jobs shown fit you.', button: 'Improve my pay check' }),
  '/tools/resume-check': copy('Is your résumé getting ignored?', 'See how recruiters read your background, then get every open job ranked for you.', 'Show me how I read', { headline: 'See how recruiters read you', sentence: 'Recruiters read your background first. Complete your profile and every open job is ranked against it.', button: 'Improve my job matches' }),
  '/tools/resume-job-match': copy('Is your résumé getting ignored?', 'See how recruiters read your background, then get every open job ranked for you.', 'Show me how I read', { headline: 'See which jobs your résumé fits', sentence: 'Each job is scored against your background. Complete your profile and the list is ranked for you.', button: 'Improve my job matches' }),
  '/resources/severance-pay': LAID_OFF_COPY,
  '/resources/linkedin-profile': copy('Is your profile getting you calls?', 'See how recruiters read your background, then get every open job ranked for you.', 'Show me how I read', { headline: 'Get found by the right recruiters', sentence: 'Recruiters search by the words on your profile. Add your target jobs and skills and the jobs shown fit what you are aiming for.', button: 'Improve my job matches' }),
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
