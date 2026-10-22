// Cross-checks AEI observed exposure against other published occupation measures
// (Microsoft "Working with AI" applicability scores; OpenAI "GPTs are GPTs"
// exposure). Different measures answer different questions, so agreement is
// reported as a rank correlation and the biggest disagreements are listed rather
// than averaged away. All three sources have AI-lab authors; say so wherever shown.
import { splitCsvLine } from './exposure'

export type ScoreMap = Map<string, number>

/** Reads a CSV column pair into a SOC-keyed map. `trim` cuts O*NET-SOC "11-1011.00" to "11-1011". */
export function scoresFromCsv(csv: string, codeColumn: string, valueColumn: string, trim = false): ScoreMap {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim())
  const ci = header.indexOf(codeColumn)
  const vi = header.indexOf(valueColumn)
  if (ci < 0 || vi < 0) throw new Error(`Missing column ${ci < 0 ? codeColumn : valueColumn}`)
  const sums = new Map<string, { sum: number; n: number }>()
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const code = trim ? (cells[ci] ?? '').slice(0, 7) : (cells[ci] ?? '')
    const v = Number(cells[vi])
    if (!/^\d\d-\d{4}$/.test(code) || !Number.isFinite(v)) continue
    const s = sums.get(code) ?? { sum: 0, n: 0 }
    s.sum += v
    s.n++
    sums.set(code, s)
  }
  return new Map([...sums].map(([k, s]) => [k, s.sum / s.n]))
}

/** Average ranks (1-based), ties share the mean rank. */
function ranks(values: number[]): number[] {
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b])
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j++
    for (let k = i; k <= j; k++) out[order[k]] = (i + j) / 2 + 1
    i = j + 1
  }
  return out
}

export interface Agreement {
  /** Occupations present in both measures. */
  n: number
  /** Spearman rank correlation, -1 to 1; null if fewer than 10 shared occupations. */
  spearman: number | null
  /** Occupations with the largest gap in percentile rank between the two measures. */
  disagreements: { socCode: string; a: number; b: number }[]
}

export function compareMeasures(a: ScoreMap, b: ScoreMap, topDisagreements = 10): Agreement {
  const codes = [...a.keys()].filter((k) => b.has(k)).sort()
  const n = codes.length
  if (n < 10) return { n, spearman: null, disagreements: [] }
  const ra = ranks(codes.map((k) => a.get(k)!))
  const rb = ranks(codes.map((k) => b.get(k)!))
  const ma = ra.reduce((s, x) => s + x, 0) / n
  const mb = rb.reduce((s, x) => s + x, 0) / n
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb)
    va += (ra[i] - ma) ** 2
    vb += (rb[i] - mb) ** 2
  }
  const spearman = va && vb ? Math.round((cov / Math.sqrt(va * vb)) * 1000) / 1000 : null
  const disagreements = codes
    .map((socCode, i) => ({ socCode, a: Math.round((ra[i] / n) * 100) / 100, b: Math.round((rb[i] / n) * 100) / 100 }))
    .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))
    .slice(0, topDisagreements)
  return { n, spearman, disagreements }
}
