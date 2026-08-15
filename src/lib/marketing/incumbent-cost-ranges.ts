// Incumbent per-seat cost ranges, by which of our tiers a buyer is
// comparing against — Partners Master Build Script §A2.1's own
// competitive-context table, not independently verified pricing. See
// docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md row 3 and the /vs pages, which
// cite the same source.
//
// Cents, to match PlanCatalogEntry.priceCents. `highUnbounded` marks the
// LHH executive row, which the source states as "$8,000-15,000+" — an
// open-ended range, not a hard ceiling; the UI must render that as "or
// more," not imply $15,000 is a cap.

export interface IncumbentRange {
  lowCents: number
  highCents: number
  highUnbounded: boolean
  /** Which grouping in the spec's §A2.1 table this maps to. */
  sourceLabel: string
}

export const INCUMBENT_COST_RANGES: Record<'outplacement_core' | 'outplacement_plus' | 'outplacement_premium', IncumbentRange> = {
  outplacement_core: {
    lowCents: 100_000,
    highCents: 300_000,
    highUnbounded: false,
    sourceLabel: 'Virtual-first providers (e.g. Careerminds, INTOO)',
  },
  outplacement_plus: {
    lowCents: 350_000,
    highCents: 700_000,
    highUnbounded: false,
    sourceLabel: 'LHH / Randstad RiseSmart, mid-level',
  },
  outplacement_premium: {
    lowCents: 800_000,
    highCents: 1_500_000,
    highUnbounded: true,
    sourceLabel: 'LHH executive outplacement',
  },
}

/** 25+ seats -10%, 100+ seats -18%, 250+ seats -25% — Master Build Script
 * §A2.2, already published on /pricing. */
export function volumeDiscountRate(seats: number): number {
  if (seats >= 250) return 0.25
  if (seats >= 100) return 0.18
  if (seats >= 25) return 0.1
  return 0
}
