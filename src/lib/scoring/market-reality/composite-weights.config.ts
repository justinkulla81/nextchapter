// Component weights for the Market Reality Grade composite — Master Build
// Script §3.4: "Store weights in config, not code. These are uncalibrated."
// Recalibrate later by regressing time-to-offer on component scores, once
// there's a real scored population to fit against. Market is deliberately
// absent — it's never weighted into the composite (§3.5, applied as a cap
// in composite.ts instead).
//
// Evidence and Effort are deliberately NOT weighted components here — the
// Market Reality Grade is a day-one artifact (what's true about your resume
// and experience right now), not a measure of platform activity. Evidence/
// Effort still get computed (evidence.ts/effort.ts) and stored on
// MarketRealityComponentScore for population analytics and for the "what
// moves the needle" levers on the Portfolio/Dossier page — they just don't
// factor into this grade.

import type { SeniorityBand } from '../resume-analysis/types'

export type WeightedComponent = 'EXPERIENCE' | 'RESUME'

type BandGroup = 'EARLY_MID' | 'SENIOR_EXECUTIVE'

// Same relative Experience:Resume emphasis the old 4-component weights
// implied (40:10 and 25:20 respectively), renormalized to sum to 100 now
// that Evidence/Effort are out of the composite entirely.
export const COMPONENT_WEIGHTS_BY_BAND_GROUP: Record<BandGroup, Record<WeightedComponent, number>> = {
  SENIOR_EXECUTIVE: { EXPERIENCE: 80, RESUME: 20 },
  EARLY_MID: { EXPERIENCE: 56, RESUME: 44 },
}

// SENIOR/EXECUTIVE bands use the Senior/Executive weight set; EARLY/MID
// (and an unknown band, before any resume has been analyzed) use Early/Mid.
export function bandGroupFor(band: SeniorityBand | null): BandGroup {
  return band === 'SENIOR' || band === 'EXECUTIVE' ? 'SENIOR_EXECUTIVE' : 'EARLY_MID'
}

export function getComponentWeights(band: SeniorityBand | null): Record<WeightedComponent, number> {
  return COMPONENT_WEIGHTS_BY_BAND_GROUP[bandGroupFor(band)]
}
