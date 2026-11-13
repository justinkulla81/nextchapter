// Re-verifying direct jobs the crawler has not confirmed lately. Pure (no database, no network), so the rules are tested on their own.
// The job itself is src/lib/jobs/direct-reverify.ts; the page and sitemap rules it serves are in public-job-page.ts.

import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'

/** How many stale direct jobs one run looks at, how many it checks at once, and how many of those at one employer's site. */
export const REVERIFY_PER_RUN = 500
export const REVERIFY_CONCURRENCY = 8
export const REVERIFY_PER_HOST = 2
/** A run stops starting new checks after this long (the bundle it runs in has 800 s in all). */
export const REVERIFY_BUDGET_MS = 150_000
export const REVERIFY_CHECK_TIMEOUT_MS = 6_000
/** If this share of a run's checks (of at least MIN_FOR_BREAKER) come back dead, something is off (a blocked crawler, a changed page): archive none. */
export const REVERIFY_BREAKER_SHARE = 0.4
export const REVERIFY_MIN_FOR_BREAKER = 20

/** One sitemap shard per run, rotating, so a run reads one sixteenth of the eligible rows through the partial index. */
export function reverifyShard(now: Date): number {
  return Math.floor(now.getTime() / 3_600_000) % PUBLIC_JOB_SITEMAP_SHARDS
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Rows ordered so neighbours sit on different hosts (round robin): one employer's site is not hit in a burst. */
export function interleaveByHost<T extends { url: string }>(rows: T[]): T[] {
  const byHost = new Map<string, T[]>()
  for (const r of rows) {
    const h = hostOf(r.url)
    const list = byHost.get(h)
    if (list) list.push(r)
    else byHost.set(h, [r])
  }
  const lists = [...byHost.values()]
  const out: T[] = []
  for (let i = 0; out.length < rows.length; i++) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

/**
 * Whether a "dead" verdict is firm enough to archive a job on, in bulk: the employer's job system answered 404 or 410 for the job, or its
 * own data says it is closed. A page whose text says "no longer available" or that redirects away is a good signal for one job a member
 * clicked, not for thousands checked unattended, so those are left alone and the crawler decides.
 */
export function isFirmDead(note: string): boolean {
  return /^(greenhouse|lever|workday) API (404|410)$/.test(note) || note === 'workday API: canApply false' || /^HTTP (404|410)$/.test(note) || /^JobPosting validThrough /.test(note)
}

/** True when the run's results look wrong enough that no job should be archived on them. */
export function breakerTripped(checked: number, firmDead: number): boolean {
  return checked >= REVERIFY_MIN_FOR_BREAKER && firmDead / checked >= REVERIFY_BREAKER_SHARE
}
