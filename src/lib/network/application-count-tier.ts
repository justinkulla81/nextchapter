import type { ConfidenceLevel } from '@/lib/scoring/grade'
import { MIN_APPLICATIONS_FOR_TRENDS } from '@/lib/network/application-trends'

// Unlike referenceCountToTier, computeApplicationTrends has only ONE real
// threshold (MIN_APPLICATIONS_FOR_TRENDS) — below it every breakdown field
// (function/industry/geography focus, volume assessment) is null, so there's
// no genuine BUILDING-tier content to reveal partway. HIGH/PROVISIONAL only,
// reusing the shared ConfidenceLevel vocabulary the same binary-gated way
// getCategoryConfidence() already does for other categories.
export function applicationCountToTier(totalApplications: number): ConfidenceLevel {
  return totalApplications >= MIN_APPLICATIONS_FOR_TRENDS ? 'HIGH' : 'PROVISIONAL'
}
