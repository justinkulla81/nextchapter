// Pay retention ratio = new base pay / prior base pay. Guardrail metric next to
// re-employment uplift: getting hired at a big cut is not the same outcome.
// Public data show about half of re-employed long-tenured workers earn less.

export interface PayRetention {
  ratio: number
  changePct: number
  tookCut: boolean
}

export function payRetention(priorBasePayUsd: number | null | undefined, newBasePayUsd: number | null | undefined): PayRetention | null {
  if (!priorBasePayUsd || !newBasePayUsd || priorBasePayUsd <= 0 || newBasePayUsd <= 0) return null
  const ratio = newBasePayUsd / priorBasePayUsd
  return { ratio, changePct: (ratio - 1) * 100, tookCut: ratio < 1 }
}

export function medianRetention(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}
