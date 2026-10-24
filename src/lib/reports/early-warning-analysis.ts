// Pure maths for the "canary" panel of the monthly White Collar Employment
// Report. No file or network access here so it can be unit tested; the CSV and
// JSON readers live in src/lib/reports-early-warning.ts.

export type Series = Map<string, number> // "YYYY-MM" -> value

const monthIdx = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return y * 12 + (mo - 1)
}
const idxMonth = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`

/**
 * Mean of the month and the two before it, computed on calendar months so a
 * month the survey skipped (October 2025) is simply left out of the average
 * rather than shifting the window. Needs at least two of the three months.
 */
export function movingAverage3(s: Series): Series {
  const out: Series = new Map()
  for (const m of s.keys()) {
    const i = monthIdx(m)
    const vals = [i - 2, i - 1, i].map((j) => s.get(idxMonth(j))).filter((v): v is number => v !== undefined)
    if (vals.length >= 2) out.set(m, vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return out
}

/** Value minus the value twelve calendar months earlier. Removes seasonality without adjustment factors. */
export function yearOverYear(s: Series): Series {
  const out: Series = new Map()
  for (const [m, v] of s) {
    const prior = s.get(idxMonth(monthIdx(m) - 12))
    if (prior !== undefined) out.set(m, v - prior)
  }
  return out
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 12) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy)
}

export interface LeadLag {
  /** Correlation at each lag, 0..maxLag months; the candidate leads the target by `lag` months. */
  byLag: { lag: number; r: number | null; n: number }[]
  best: { lag: number; r: number } | null
}

/**
 * Does `candidate` move before `target`? Correlates the candidate's year-over-year
 * change at month t with the target's at month t + lag. `exclude` drops any pair
 * where either month falls in the inclusive [from, to] window (e.g. a shock year
 * that would otherwise dominate the correlation).
 */
export function leadLag(candidate: Series, target: Series, maxLag = 12, exclude?: [string, string]): LeadLag {
  const inWindow = (m: string) => !!exclude && m >= exclude[0] && m <= exclude[1]
  const byLag: LeadLag['byLag'] = []
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs: number[] = [], ys: number[] = []
    for (const [m, v] of candidate) {
      const tm = idxMonth(monthIdx(m) + lag)
      if (inWindow(m) || inWindow(tm)) continue
      const t = target.get(tm)
      if (t !== undefined) { xs.push(v); ys.push(t) }
    }
    byLag.push({ lag, r: pearson(xs, ys), n: xs.length })
  }
  let best: LeadLag['best'] = null
  for (const b of byLag) if (b.r !== null && (best === null || b.r > best.r)) best = { lag: b.lag, r: b.r }
  return { byLag, best }
}

export type Verdict = 'leads' | 'moves-with' | 'unclear'

/**
 * A group is called a leading signal only when its best lag is at least three
 * months, the correlation there is clearly positive, and it beats the
 * same-month correlation by a margin. Anything weaker is reported as moving
 * with the target or unclear. These thresholds are deliberately strict: a
 * canary claim needs to survive being wrong in public.
 */
export function verdictFor(ll: LeadLag): Verdict {
  if (!ll.best || ll.best.r < 0.3) return 'unclear'
  const zero = ll.byLag[0]?.r ?? 0
  if (ll.best.lag >= 3 && ll.best.r >= 0.4 && ll.best.r - (zero ?? 0) >= 0.05) return 'leads'
  return 'moves-with'
}

/** Ratio of youth to total unemployment; "how much worse is it for the young". */
export const youthRatio = (youth: number, total: number) => (total > 0 ? youth / total : NaN)
