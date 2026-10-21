/**
 * Pay for an occupation at three levels of "where": the person's metro area, their state, and
 * the nation. Pure, so the choice of which figure to show, and how two occupations are compared,
 * is tested without a database.
 *
 * Why it matters: median pay for the same job differs a lot between, say, Boston and rural Maine,
 * and comparing a Boston figure for one job with a national figure for another gives a wrong
 * "pay change". Comparisons here use the same place on both sides.
 */
export type PayLevel = 'METRO' | 'STATE' | 'NATIONAL'

export interface PayInfo {
  level: PayLevel
  areaName: string
  median: number | null
  p10: number | null
  p25: number | null
  p75: number | null
  p90: number | null
  employment: number | null
  /** BLS withheld at least one figure because it was at or above its published wage ceiling. */
  ceilingHit: boolean
}

export type PayByLevel = Partial<Record<PayLevel, PayInfo>>

/**
 * BLS OEWS publishes annual wages at or above this as "#" instead of a number ($115 an hour).
 * Executive pay is often above it. Confirm against the footnote of each year's release.
 */
export const OEWS_WAGE_CEILING = 239_200

const NARROWEST_FIRST: PayLevel[] = ['METRO', 'STATE', 'NATIONAL']

/** The most local figure that says something: a median, or at least that pay is at the ceiling. */
export function bestPay(pay: PayByLevel): PayInfo | null {
  for (const level of NARROWEST_FIRST) {
    const p = pay[level]
    if (p && (p.median !== null || p.ceilingHit)) return p
  }
  return null
}

export interface PayComparison {
  /** The figure to show for the target occupation. */
  pay: PayInfo | null
  /** Percent difference from the source occupation at the same place; null when no like-for-like pair exists. */
  deltaPct: number | null
  /** The target's exact pay is withheld above the ceiling, so deltaPct is a floor ("at least"). */
  atLeast: boolean
  basis: PayLevel | null
}

/**
 * Compares target to source at the narrowest place where both have something usable. If only the
 * target's median is withheld for being at the ceiling, the change is reported as "at least" what
 * the ceiling implies, never as a guess at the real figure.
 */
export function comparePay(source: PayByLevel, target: PayByLevel): PayComparison {
  for (const level of NARROWEST_FIRST) {
    const s = source[level]
    const t = target[level]
    if (!s || !s.median || !t) continue
    if (t.median) {
      return { pay: t, deltaPct: Math.round(((t.median - s.median) / s.median) * 100), atLeast: false, basis: level }
    }
    if (t.ceilingHit) {
      const floorPct = Math.round(((OEWS_WAGE_CEILING - s.median) / s.median) * 100)
      if (floorPct > 0) return { pay: t, deltaPct: floorPct, atLeast: true, basis: level }
    }
  }
  return { pay: bestPay(target), deltaPct: null, atLeast: false, basis: null }
}

/** "$79,880" */
export const formatPay = (n: number) => `$${n.toLocaleString('en-US')}`

/** One line for the pay figure on a card. */
export function describePay(pay: PayInfo | null): string {
  if (!pay) return 'Not published for this role'
  if (pay.median !== null) return formatPay(pay.median)
  if (pay.ceilingHit) return `${formatPay(OEWS_WAGE_CEILING)} or more`
  return 'Not published for this role'
}
