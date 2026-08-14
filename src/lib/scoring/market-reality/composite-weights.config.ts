// Component weights for the Market Reality Grade composite — Master Build
// Script §3.4: "Store weights in config, not code. These are uncalibrated."
// Recalibrate later by regressing time-to-offer on component scores, once
// there's a real scored population to fit against. Market is deliberately
// absent — it's never weighted into the composite (§3.5, applied as a cap
// in composite.ts instead).

import type { SeniorityBand } from '../resume-analysis/types'

export type WeightedComponent = 'EXPERIENCE' | 'RESUME' | 'EVIDENCE' | 'EFFORT'

type BandGroup = 'EARLY_MID' | 'SENIOR_EXECUTIVE'

export const COMPONENT_WEIGHTS_BY_BAND_GROUP: Record<BandGroup, Record<WeightedComponent, number>> = {
  SENIOR_EXECUTIVE: { EXPERIENCE: 40, EVIDENCE: 30, EFFORT: 20, RESUME: 10 },
  EARLY_MID: { EXPERIENCE: 25, EVIDENCE: 25, EFFORT: 30, RESUME: 20 },
}

// SENIOR/EXECUTIVE bands use the Senior/Executive weight set; EARLY/MID
// (and an unknown band, before any resume has been analyzed) use Early/Mid.
export function bandGroupFor(band: SeniorityBand | null): BandGroup {
  return band === 'SENIOR' || band === 'EXECUTIVE' ? 'SENIOR_EXECUTIVE' : 'EARLY_MID'
}

export function getComponentWeights(band: SeniorityBand | null): Record<WeightedComponent, number> {
  return COMPONENT_WEIGHTS_BY_BAND_GROUP[bandGroupFor(band)]
}
