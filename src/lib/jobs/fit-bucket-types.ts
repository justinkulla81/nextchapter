// Pure types/constants for the Quick-read fit bucket — deliberately no
// 'server-only' import here (unlike job-fit-bucket.ts, which computes the
// bucket using compute-match-score.ts) so client components can render the
// label without pulling server-only code into the client bundle.

export type FitBucket = 'strong' | 'good' | 'stretch'

export const FIT_BUCKET_LABEL: Record<FitBucket, string> = {
  strong: 'Strong fit',
  good: 'Good fit',
  stretch: 'Stretch',
}

// Listings live on the board for up to 30 days (see THIRTY_DAYS_MS in
// ats-job-board-feed.ts / job-board-submission.ts) — "new" is a much
// tighter window than that, just long enough to flag a listing a candidate
// genuinely hasn't had a chance to see yet on a prior visit.
const NEW_LISTING_WINDOW_DAYS = 5

export function isRecentlyListed(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime()
  return ageMs < NEW_LISTING_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
