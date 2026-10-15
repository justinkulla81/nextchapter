import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import type { ComparisonColumn, ComparisonRow, Distribution, RelationshipRow, Unit } from './types'

export const round1 = (n: number) => Math.round(n * 10) / 10

export function pct(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round1((numerator / denominator) * 100)
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : round1(values.reduce((s, v) => s + v, 0) / values.length)
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? round1((s[mid - 1] + s[mid]) / 2) : s[mid]
}

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim()
  return t ? t : null
}

function finish(counts: Map<string, number>, n: number, unknown: number, topN: number): Distribution {
  const all = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const visible = all.filter(([, c]) => c >= MIN_CELL_SIZE)
  const shown = visible.slice(0, topN)
  return {
    n,
    unknown,
    rows: shown.map(([label, count]) => ({ label, count, share: round1((count / n) * 100) })),
    // Groups that were too small AND groups cut by the top-N both count as not shown.
    hiddenGroups: all.length - shown.length,
  }
}

/** One answer per member. Groups under MIN_CELL_SIZE never appear. */
export function distribution(
  values: Array<string | null | undefined>,
  opts: { topN?: number; label?: (v: string) => string } = {},
): Distribution {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const raw of values) {
    const v = clean(raw)
    if (!v) { unknown++; continue }
    const key = opts.label ? opts.label(v) : v
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return finish(counts, values.length - unknown, unknown, opts.topN ?? 12)
}

/**
 * Several answers per member (a multi-select). Each member counts once per
 * distinct answer; shares are of members who gave at least one answer.
 */
export function multiDistribution(
  lists: Array<Array<string | null | undefined> | null | undefined>,
  opts: { topN?: number; label?: (v: string) => string } = {},
): Distribution {
  const counts = new Map<string, number>()
  let answered = 0
  for (const list of lists) {
    const seen = new Set<string>()
    for (const raw of list ?? []) {
      const v = clean(raw)
      if (!v) continue
      seen.add(opts.label ? opts.label(v) : v)
    }
    if (seen.size === 0) continue
    answered++
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return finish(counts, answered, lists.length - answered, opts.topN ?? 12)
}

export function band(value: number | null | undefined, edges: Array<{ max: number; label: string }>, top: string): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  for (const e of edges) if (value <= e.max) return e.label
  return top
}

// ── Correlation ──────────────────────────────────────────────────────

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k][1]] = avg
    i = j + 1
  }
  return out
}

/** Spearman rank correlation. Null when fewer than 3 pairs or either side never varies. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null
  const rx = ranks(xs)
  const ry = ranks(ys)
  const mx = rx.reduce((s, v) => s + v, 0) / rx.length
  const my = ry.reduce((s, v) => s + v, 0) / ry.length
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  if (dx === 0 || dy === 0) return null
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100
}

/** A correlation on fewer members than this says nothing; we show "not enough members". */
export const MIN_CORRELATION_N = 30

export function strengthOf(rho: number | null, n: number): RelationshipRow['strength'] {
  if (rho === null || n < MIN_CORRELATION_N) return 'insufficient'
  const a = Math.abs(rho)
  if (a < 0.1) return 'none'
  if (a < 0.3) return 'weak'
  if (a < 0.5) return 'moderate'
  return 'strong'
}

export function relationship(a: string, b: string, pairs: Array<[number, number]>): RelationshipRow {
  const n = pairs.length
  if (n < MIN_CORRELATION_N) return { a, b, rho: null, n, strength: 'insufficient' }
  const rho = spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1]))
  return { a, b, rho, n, strength: strengthOf(rho, n) }
}

// ── Group comparison ─────────────────────────────────────────────────

/**
 * Splits members by `groupOf`, and reports each column's value per group.
 * Groups under MIN_CELL_SIZE members are dropped and only counted.
 */
export function compareGroups<T>(
  members: T[],
  groupOf: (m: T) => string | null,
  columns: Array<ComparisonColumn & { compute: (group: T[]) => number | null }>,
  opts: { topN?: number; sort?: 'size' | 'label' } = {},
): { columns: ComparisonColumn[]; rows: ComparisonRow[]; hiddenGroups: number } {
  const groups = new Map<string, T[]>()
  for (const m of members) {
    const g = groupOf(m)
    if (!g) continue
    const list = groups.get(g)
    if (list) list.push(m)
    else groups.set(g, [m])
  }
  const all = [...groups.entries()]
  const visible = all
    .filter(([, list]) => list.length >= MIN_CELL_SIZE)
    .sort((a, b) => (opts.sort === 'label' ? a[0].localeCompare(b[0]) : b[1].length - a[1].length))
    .slice(0, opts.topN ?? 10)
  return {
    columns: columns.map(({ key, label, unit }) => ({ key, label, unit })),
    rows: visible.map(([label, list]) => ({
      label,
      n: list.length,
      values: Object.fromEntries(columns.map((c) => [c.key, c.compute(list)])),
    })),
    hiddenGroups: all.length - visible.length,
  }
}

export function formatValue(value: number | null | undefined, unit: Unit): string {
  if (value === null || value === undefined) return '—'
  if (unit === 'pct') return `${value}%`
  if (unit === 'days') return `${value} day${value === 1 ? '' : 's'}`
  return String(value)
}
