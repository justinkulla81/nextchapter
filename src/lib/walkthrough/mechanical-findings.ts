// Per-finding walkthrough steps (§13.1's "mechanical batch," widened) —
// pulls EVERY dimension's findings off the candidate's latest
// ResumeAnalysis (already computed on every upload — see
// src/app/dashboard/resume/actions.ts), not just atsLegibility/
// mechanicsPresentation. This is the missing UI over already-real data,
// not a new analysis pass. Kept the 'mechanical' screen kind / key format /
// resolveMechanicalFindingAction naming from when this only covered those
// two dimensions — the mechanism itself was always dimension-agnostic
// (keyed by `${dimension}:${index}`), only the dimension list was narrow.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { DIMENSION_ORDER, type DimensionFindings, type DimensionKey, type Finding } from '@/lib/scoring/resume-analysis/types'

export interface MechanicalBatchFinding {
  // Stable within one ResumeAnalysis (findings arrays don't reorder between
  // reads of the same row) — used as the walkthrough's per-finding progress
  // key and as the screen-plan identifier.
  key: string
  dimension: DimensionKey
  finding: Finding
}

export async function getMechanicalBatchFindings(candidateId: string): Promise<MechanicalBatchFinding[]> {
  const latest = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { dimensionFindings: true },
  })
  if (!latest) return []

  const findings = latest.dimensionFindings as unknown as DimensionFindings
  const result: MechanicalBatchFinding[] = []
  for (const dimension of DIMENSION_ORDER) {
    const list = findings?.[dimension] ?? []
    list.forEach((finding, index) => {
      result.push({ key: `${dimension}:${index}`, dimension, finding })
    })
  }
  return result
}
