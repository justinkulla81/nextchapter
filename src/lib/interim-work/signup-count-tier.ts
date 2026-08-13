import type { ConfidenceLevel } from '@/lib/scoring/grade'

// Same shape as referenceCountToTier — InterimMarketplaceSignup counts
// support a real BUILDING-tier breakdown (by InterimListing.category) well
// before the HIGH threshold, unlike applicationCountToTier's single binary
// gate.
export function signupCountToTier(signupCount: number): ConfidenceLevel {
  if (signupCount >= 5) return 'HIGH'
  if (signupCount >= 3) return 'BUILDING'
  return 'PROVISIONAL'
}
