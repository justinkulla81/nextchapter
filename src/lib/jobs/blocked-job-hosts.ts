// Job sites known to be unusable for an automatic fetch — either they
// require sign-in / run bot-detection, or (like Greenhouse) they return a
// real 200 response that LOOKS like content but is actually the generic
// "openings list" shell rather than the specific posting, since the actual
// job details load client-side via JavaScript. Checked BEFORE attempting a
// fetch (not just after one fails) so submitting one of these URLs goes
// straight to the "paste the text" path instead of wasting a request and an
// LLM call on unusable or wrong content. Plain module (no 'server-only') so
// the client-side form can give the same instant feedback before submitting.
interface BlockedJobHost {
  pattern: RegExp
  name: string
  reason: string
}

const BLOCKED_JOB_HOSTS: BlockedJobHost[] = [
  { pattern: /(^|\.)linkedin\.com$/i, name: 'LinkedIn', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)indeed\.com$/i, name: 'Indeed', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)glassdoor\.com$/i, name: 'Glassdoor', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)ziprecruiter\.com$/i, name: 'ZipRecruiter', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)monster\.com$/i, name: 'Monster', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)dice\.com$/i, name: 'Dice', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)simplyhired\.com$/i, name: 'SimplyHired', reason: 'requires signing in to view postings' },
  { pattern: /(^|\.)careerbuilder\.com$/i, name: 'CareerBuilder', reason: 'requires signing in to view postings' },
  {
    pattern: /(^|\.)greenhouse\.io$/i,
    name: 'Greenhouse',
    reason: "loads each job's details with JavaScript, so we can only see the generic openings list, not the specific posting",
  },
]

export function getBlockedJobHost(url: string): { name: string; reason: string } | null {
  try {
    const hostname = new URL(url).hostname
    return BLOCKED_JOB_HOSTS.find((b) => b.pattern.test(hostname)) ?? null
  } catch {
    return null
  }
}
