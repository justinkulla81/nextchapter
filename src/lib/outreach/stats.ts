/** Two-sided p-value for two rates (pooled z-test). 1 when either side has no sends. */
export function pValue(a: { sends: number; hits: number }, b: { sends: number; hits: number }): number {
  if (!a.sends || !b.sends) return 1
  const p = (a.hits + b.hits) / (a.sends + b.sends)
  const se = Math.sqrt(p * (1 - p) * (1 / a.sends + 1 / b.sends))
  if (!se) return 1
  const z = Math.abs((a.hits / a.sends - b.hits / b.sends) / se)
  const t = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp((-z * z) / 2)
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return Math.min(1, 2 * tail)
}

/** Sends per variant to tell two reply rates apart at 80% power and 5% significance; null when the rates are nearly equal. */
export function sendsNeeded(p1: number, p2: number): number | null {
  const d = Math.abs(p1 - p2)
  if (d < 0.005) return null
  const pb = (p1 + p2) / 2
  return Math.ceil((2 * (1.96 + 0.84) ** 2 * pb * (1 - pb)) / (d * d))
}
