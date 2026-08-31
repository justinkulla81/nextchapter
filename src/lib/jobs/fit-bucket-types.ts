// Pure types/constants for the Quick-read fit bucket — deliberately no
// 'server-only' import here (unlike job-fit-bucket.ts, which computes the
// bucket using compute-match-score.ts) so client components can render the
// label without pulling server-only code into the client bundle.

// 'stretch' means the role reaches above the candidate's own level (or the
// level comparison is inconclusive) — a real aim-higher case, never a
// downgrade. 'below_level' and 'overqualified' are the opposite direction:
// the candidate is above the role's level. 'overqualified' is the extreme
// case (e.g. a former CEO/Partner shown a Manager posting); 'below_level'
// is a milder step down. All three land below the "good fit" score
// threshold, but reading a genuine downgrade with the same "Stretch" label
// was actively misleading, so they're split into distinct buckets. See
// computeBoardListingFitBucket/computeSurfacedJobFitBucket in
// job-fit-bucket.ts for the direction check.
export type FitBucket = 'strong' | 'good' | 'stretch' | 'below_level' | 'overqualified'

// Labels frame the seniority relationship between the candidate and the
// role rather than a generic "quality of match" — 'strong' and 'good' both
// clear the "real recommendation" bar (see isWeakFit below) but differ in
// how closely the role's function/industry lines up at the same level,
// hence "On Target" vs "Lateral." 'below_level' and 'overqualified' share
// one label — the distinction between a mild vs. extreme step down isn't
// worth a second badge string, just the underlying bucket used elsewhere
// (isWeakFit, sort order).
export const FIT_BUCKET_LABEL: Record<FitBucket, string> = {
  strong: 'On Target',
  good: 'Lateral',
  stretch: 'Step Up',
  below_level: 'Step Down',
  overqualified: 'Step Down',
}

// None of these buckets clears the "good fit" score threshold — used
// wherever a caller needs "is this a real recommendation" rather than the
// specific reason it isn't.
export function isWeakFit(bucket: FitBucket): boolean {
  return bucket === 'stretch' || bucket === 'below_level' || bucket === 'overqualified'
}

// Recommendation-list display order: confidently-scored matches (On
// Target/Lateral) lead, since those are real recommendations, not just
// "inconclusive." Step Up comes next — a genuine aim-higher case is worth
// seeing, just after (not before) what's actually a solid match — and a
// real downgrade sorts last. Previously Step Up sorted first on the theory
// that reaching higher beats a downgrade, but bucketFromScoreAndLevel also
// returns 'stretch' whenever level data is simply missing/inconclusive —
// not only for genuine aim-higher postings — so an under-scored, unrelated
// posting (wrong function, wrong industry) was routinely outranking a
// confidently strong/good match just because its level couldn't be read.
// Lower number sorts first.
export const FIT_BUCKET_SORT_RANK: Record<FitBucket, number> = {
  strong: 0,
  good: 1,
  stretch: 2,
  below_level: 3,
  overqualified: 4,
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
