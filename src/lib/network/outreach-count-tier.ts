import type { ConfidenceLevel } from '@/lib/scoring/grade'

// Unlike applicationCountToTier's single binary gate, OutreachLog counts
// support a real BUILDING-tier breakdown (by channel — email, LinkedIn,
// phone, text, meeting) well before the HIGH threshold, the same shape as
// referenceCountToTier.
export function outreachCountToTier(loggedCount: number): ConfidenceLevel {
  if (loggedCount >= 5) return 'HIGH'
  if (loggedCount >= 3) return 'BUILDING'
  return 'PROVISIONAL'
}
