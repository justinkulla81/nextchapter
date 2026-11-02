import data from './occupation-projections.json'
import { growthWords } from '@/lib/pivots/occupation-outlook'

// BLS Employment Projections for every occupation (public domain), built by scripts/pivots/import-occupation-projections.ts.
// No request-time calls. Yearly refresh when BLS publishes new projections.

export interface OccupationProjection {
  soc6: string
  /** BLS's own name for the occupation the figures describe. */
  title: string
  /** Projected employment change over the period, whole percent. */
  pctChange: number
  annualOpenings: number | null
  /** National median annual wage, all levels (BLS OEWS). */
  medianWage: number | null
  employment: number | null
  baseYear: string
  projectedYear: string
  wageYear: string | null
  source: string
}

const D = data as unknown as { source: string; baseYear: string; projectedYear: string; wageYear: string | null; occupations: Record<string, [string, number, number | null, number | null, number | null]> }

export function projectionFor(soc6: string | null | undefined): OccupationProjection | null {
  const r = soc6 ? D.occupations[soc6.slice(0, 7)] : undefined
  return r
    ? { soc6: soc6!.slice(0, 7), title: r[0], pctChange: r[1], annualOpenings: r[2], medianWage: r[3], employment: r[4], baseYear: D.baseYear, projectedYear: D.projectedYear, wageYear: D.wageYear, source: D.source }
    : null
}

/** "Projected to grow 10% from 2025 to 2035, faster than average." Never says what will happen to one person. */
export function projectionLine(p: OccupationProjection): string {
  const span = `from ${p.baseYear} to ${p.projectedYear}`
  if (p.pctChange >= 2) return `Projected to grow ${p.pctChange}% ${span} (${growthWords(p.pctChange)}).`
  if (p.pctChange > -2) return `Projected ${p.pctChange >= 0 ? '+' : ''}${p.pctChange}% ${span} (${growthWords(p.pctChange)}).`
  return `Projected to shrink ${Math.abs(p.pctChange)}% ${span}.`
}
