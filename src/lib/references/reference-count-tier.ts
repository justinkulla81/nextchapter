import type { ConfidenceLevel } from '@/lib/scoring/grade'

// Reference Check aggregation confidence (Assessment Layer spec §5.8) —
// shares the ConfidenceLevel enum/labels/copy with Market Reality's
// category tiers (grade.ts) rather than inventing a second wording, per
// the founder's call to standardize on "Confirmed" everywhere. Extracted
// as its own pure function (rather than folded into
// getCategoryConfidence's hardcoded switch in dossier-competencies.ts)
// because the input here is a graduated response count, not a binary
// "has at least one" gate the way every other category checks it.
export function referenceCountToTier(completedCount: number): ConfidenceLevel {
  if (completedCount >= 5) return 'HIGH'
  if (completedCount >= 3) return 'BUILDING'
  return 'PROVISIONAL'
}
