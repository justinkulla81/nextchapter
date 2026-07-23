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
