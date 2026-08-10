// Buckets the 0-100 analyzeJobFit LLM score into a short label for display
// on the job-fit-check card — deliberately no raw number shown to the
// candidate (matches the sitewide "no precise-looking scores" convention),
// but still coarser and less abstract than a letter grade for this
// one-off, single-posting context.
export type FitScoreLabel = 'Perfect Fit' | 'Strong Fit' | 'Good Fit' | 'Poor Fit'

export function fitScoreToLabel(score: number): FitScoreLabel {
  if (score >= 90) return 'Perfect Fit'
  if (score >= 75) return 'Strong Fit'
  if (score >= 60) return 'Good Fit'
  return 'Poor Fit'
}
