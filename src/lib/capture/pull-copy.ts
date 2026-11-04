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

const BY_ROOT: Record<string, PullCopy> = {
  layoffs: LAID_OFF_COPY,
  'unemployment-benefits': LAID_OFF_COPY,
  start: LAID_OFF_COPY,
  salaries: PAY_COPY,
  salary: PAY_COPY,
  'ai-skills': AI_COPY,
  'ai-job-check': AI_COPY,
}

/** The copy for a page, chosen from the first folder of its path ("/layoffs/this-week" reads "layoffs"). */
export function pullCopyFor(path: string): PullCopy {
  const root = path.split('?')[0].split('/').filter(Boolean)[0] ?? ''
  return BY_ROOT[root] ?? DEFAULT_COPY
}
