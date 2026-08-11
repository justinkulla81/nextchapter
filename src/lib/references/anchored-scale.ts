// Reference Check's anchored 1-4 performance scale (Assessment Layer spec
// §5.2) — shared between Part A rating items and the aggregation/report
// layer that converts averages back to a label. Distinct from the 1-5 BARS
// scale used for style ratings (see reference-delta.ts) — never mix the two.
//
// UI RULE, load-bearing: render all four options at equal visual weight.
// No red-to-green gradient, no highlighting/enlarging 4, no ordering that
// makes 4 read as "the goal." If the interface makes "Solid" look like a C,
// raters inflate and the instrument loses discrimination. Any component
// rendering this scale must give ANCHOR_LABELS equal type size, equal
// color weight, and equal spacing — see ReferencePerformanceScale.tsx.

export const ANCHOR_LABELS = {
  1: 'Below what the role needed',
  2: 'Solid — did the job well',
  3: 'Notably strong — better than most at this level',
  4: 'Exceptional — one of the best I\'ve worked with',
} as const

export type AnchorScore = 1 | 2 | 3 | 4

export function anchorLabel(score: AnchorScore | null | undefined): string | null {
  if (score == null) return null
  return ANCHOR_LABELS[score]
}

// Converts a mean score to the nearest anchor label for display — never
// show the raw numeric mean to anyone (spec §5.8: "Never display a numeric
// mean. Display the anchor label the mean rounds to, with n alongside.")
export function meanToAnchorLabel(mean: number): string {
  const rounded = Math.min(4, Math.max(1, Math.round(mean))) as AnchorScore
  return ANCHOR_LABELS[rounded]
}
