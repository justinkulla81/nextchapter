// Employers that must not appear in the aggregator feeds (src/lib/syndication/job-feed-server.ts).
// No opt-out table exists in the database, so this is a code list plus the JOB_FEED_OPTOUT_COMPANIES
// environment variable (comma-separated company names). Names match exactly, ignoring case and punctuation.

const FEED_OPTOUT_COMPANIES: readonly string[] = []

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function feedOptOutSet(env: Record<string, string | undefined> = process.env): Set<string> {
  const extra = (env.JOB_FEED_OPTOUT_COMPANIES ?? '').split(',')
  return new Set([...FEED_OPTOUT_COMPANIES, ...extra].map(norm).filter(Boolean))
}

export function isFeedOptedOut(companyName: string, optOut: ReadonlySet<string> = feedOptOutSet()): boolean {
  return optOut.has(norm(companyName))
}
