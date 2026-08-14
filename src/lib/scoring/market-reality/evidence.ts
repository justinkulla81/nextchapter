// Evidence component — Master Build Script §3.1: "What others confirm: the
// five competencies, from references, assessments, and activity. This
// equals Dossier completeness." Sourced directly from the 5x3 competency
// grid (competency-grid.ts) rather than an ad-hoc reference-count +
// assessment-boolean heuristic — the grid IS the Evidence component now,
// not a separate parallel computation. Recomputes the grid live on every
// call rather than relying on an event trigger elsewhere in the app (the
// grid's own module is trigger-agnostic — see its header comment) so this
// component is always correct without needing to wire a recompute hook
// into every reference/assessment submission action.

import 'server-only'
import { computeCompetencyGrid, getCompetencyGridDisplay, TOTAL_GRID_CELLS } from '@/lib/scoring/competency-grid'
import type { ComponentComputation } from './types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function computeEvidenceComponent(candidateId: string): Promise<ComponentComputation> {
  await computeCompetencyGrid(candidateId)
  const grid = await getCompetencyGridDisplay(candidateId)

  // Completion: how much of the grid is filled in, 0-100.
  const completionScore = clamp((grid.cellsMeasured / grid.cellsTotal) * 100)

  // Quality: average of every measured cell's score — genuinely zero
  // contribution when nothing is measured yet (day one, honestly zero, per
  // §3.6), not a neutral default that would understate an early candidate's
  // actual state.
  const measuredScores = grid.rows.flatMap((r) => r.cells.filter((c) => c.measured && c.score !== null).map((c) => c.score as number))
  const qualityScore = measuredScores.length > 0 ? clamp(measuredScores.reduce((s, v) => s + v, 0) / measuredScores.length) : 0

  const score = grid.cellsMeasured === 0 ? 0 : clamp(0.6 * completionScore + 0.4 * qualityScore)

  const drivers: string[] = []
  if (grid.cellsMeasured === 0) {
    drivers.push('Nothing in the Dossier is confirmed yet — everything on file is currently self-reported.')
  } else {
    drivers.push(`${grid.cellsMeasured} of ${TOTAL_GRID_CELLS} Dossier cells filled.`)
    const emptyCompetencies = grid.rows.filter((r) => r.sourcesMeasured === 0)
    if (emptyCompetencies.length > 0) {
      drivers.push(`${emptyCompetencies.map((r) => r.label).join(', ')} still has no corroboration.`)
    }
  }

  return { score, drivers }
}
