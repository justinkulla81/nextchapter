import { BAND_LABEL, type OccupationExposure } from '@/lib/skills/ai-exposure'

// Pure copy for the career pivots page: how a role's observed AI exposure compares with the member's current occupation,
// and the like-for-like pay change shown beside it. Both say what the data shows, never what will happen.

/** "Your current role: Some. This role: High." Only when both occupations are measured. */
export function exposureComparisonLine(current: OccupationExposure | null, role: OccupationExposure | null): string | null {
  if (!current || !role) return null
  return `Your current role: ${BAND_LABEL[current.band]}. This role: ${BAND_LABEL[role.band]}.`
}

/** "Pays 12% more than your field", from comparePay's delta. Null when there is no pay comparison. */
export function payChangeLine(deltaPct: number | null, atLeast: boolean): string | null {
  if (deltaPct === null) return null
  if (atLeast) return `Pays at least ${Math.abs(deltaPct)}% ${deltaPct < 0 ? 'less' : 'more'} than your field`
  if (deltaPct === 0) return 'Pays about the same as your field'
  return `Pays ${Math.abs(deltaPct)}% ${deltaPct > 0 ? 'more' : 'less'} than your field`
}
