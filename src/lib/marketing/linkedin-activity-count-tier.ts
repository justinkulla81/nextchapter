import type { ConfidenceLevel } from '@/lib/scoring/grade'

// Same house convention as referenceCountToTier/outreach-count-tier/etc.
// LinkedInActivityLog has no categorical field (just candidateId + loggedAt,
// one row per day) — nothing to build a "well-rounded mix" checklist from,
// same reasoning as application-count-tier.ts.
export function linkedInActivityCountToTier(loggedDayCount: number): ConfidenceLevel {
  if (loggedDayCount >= 5) return 'HIGH'
  if (loggedDayCount >= 3) return 'BUILDING'
  return 'PROVISIONAL'
}
