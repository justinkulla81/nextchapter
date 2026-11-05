// "Check my fit" on a public job page starts onboarding for someone who may already have an account. The job's id is kept in
// a short-lived cookie so that, if the email turns out to belong to a registered account, "Log in" goes back to that job in the
// portal instead of the dashboard. A flag for where to land, never a credential. No server-only imports: the proxy sets it.
export const FIT_JOB_COOKIE = 'nc_fit_job'
export const FIT_JOB_MAX_AGE_SECONDS = 24 * 60 * 60
const JOB_ID = /^c[a-z0-9]{20,32}$/

/** The job id carried by a "Check my fit" link (`?from=jobs_page&job=<id>`), or null. */
export function fitJobFromSearch(search: string): string | null {
  const q = new URLSearchParams(search)
  const job = q.get('job') ?? ''
  return q.get('from') === 'jobs_page' && JOB_ID.test(job) ? job : null
}

/** Where a member who logs in after the duplicate-account notice should land: the job they asked about, or undefined. */
export function fitJobNext(cookieValue: string | undefined): string | undefined {
  return cookieValue && JOB_ID.test(cookieValue) ? `/dashboard/jobs/${cookieValue}?src=check_fit` : undefined
}
