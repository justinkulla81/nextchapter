import type { ConfidenceLevel } from '@/lib/scoring/grade'

// Same shape as referenceCountToTier — LearningBadge counts support a real
// BUILDING-tier breakdown (by badgeType) well before the HIGH threshold,
// unlike applicationCountToTier's single binary gate.
export function badgeCountToTier(badgeCount: number): ConfidenceLevel {
  if (badgeCount >= 5) return 'HIGH'
  if (badgeCount >= 3) return 'BUILDING'
  return 'PROVISIONAL'
}
