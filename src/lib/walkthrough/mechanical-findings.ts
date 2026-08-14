// "Mechanical batch" step (§13.1) — pulls the atsLegibility and
// mechanicsPresentation dimension findings off the candidate's latest
// ResumeAnalysis (already computed on every upload as of the §12 work —
// see src/app/dashboard/resume/actions.ts). This is the missing UI over
// already-real data, not a new analysis pass.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { DimensionFindings, Finding } from '@/lib/scoring/resume-analysis/types'

export type MechanicalDimension = 'atsLegibility' | 'mechanicsPresentation'

export interface MechanicalBatchFinding {
  // Stable within one ResumeAnalysis (findings arrays don't reorder between
  // reads of the same row) — used as the walkthrough's per-finding progress
  // key and as the screen-plan identifier.
  key: string
  dimension: MechanicalDimension
  finding: Finding
}

const MECHANICAL_DIMENSIONS: MechanicalDimension[] = ['atsLegibility', 'mechanicsPresentation']

export async function getMechanicalBatchFindings(candidateId: string): Promise<MechanicalBatchFinding[]> {
  const latest = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { dimensionFindings: true },
  })
  if (!latest) return []

  const findings = latest.dimensionFindings as unknown as DimensionFindings
  const result: MechanicalBatchFinding[] = []
  for (const dimension of MECHANICAL_DIMENSIONS) {
    const list = findings?.[dimension] ?? []
    list.forEach((finding, index) => {
      result.push({ key: `${dimension}:${index}`, dimension, finding })
    })
  }
  return result
}
