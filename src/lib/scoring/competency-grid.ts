// The 5x3 competency grid — Master Build Script §4. Deliberately separate
// from, and does not replace, the live six-category blended grade in
// dossier-competencies.ts (23 files depend on that system — weekly effort
// nudges, A-grade gates, coach bonuses — and the Master Build Script
// explicitly resolved that both systems stay: "the live six-category grade
// and the new engine are different objects"). This module only WRITES a
// new, additive CompetencyScore table that the new Your Evidence component
// (market-reality/evidence.ts) and, later, the Market Reality Report read
// from — it never touches categoryBaselineScores or the weekly grade.
//
// Each competency is scored per evidence source, never blended across
// sources (§4) — References, Assessment, and Activity each get their own
// cell. Deliberately no Resume column/source: Your Experience/Your Resume
// already score everything the resume says (§4: "a resume therefore fills
// 0 of 15 cells — this is the intended state").
//
// Source mapping decisions made here:
//   - References: reuses the exact same trait-field-per-competency mapping
//     dossier-competencies.ts already established (traitPresenceRating ->
//     Leadership, overallRating -> Skills, traitCollaborationRating ->
//     Communication, traitAdaptabilityRating -> Adaptability,
//     traitFollowThroughRating -> Ownership) — not a new invention, the
//     same fields the legacy blended grade already reads.
//   - Assessment: §4.1 names five source dimensions (Presence,
//     Collaboration, Adaptability, Composure, Follow-Through) that don't
//     exist anywhere in the codebase as their own named instrument (no
//     "Personality Profile" model exists yet — confirmed by grep). The
//     closest live, completed, psychometric self-report is
//     PerformanceAssessmentResponse ("How I Perform": execution/judgment/
//     composure/influence) — the same instrument dossier-competencies.ts
//     already uses as the "richer instrument that replaces the self-report
//     slider" for these exact competencies (see performanceSelfReport()
//     calls there). Reused here rather than inventing a second, competing
//     scoring path: Leadership<-influenceScore, Communication<-influenceScore
//     (legacy blends both from influence too), Adaptability<-avg(judgment,
//     composure), Ownership<-avg(execution, composure), Skills<-none (per
//     spec). Building a dedicated "Personality Profile" instrument with
//     exactly the named dimensions is real follow-up work, not done here.
//   - Activity: genuinely unspecified by the spec beyond "Skills gets
//     references+activity, no assessment." Left fully unmeasured for now —
//     no per-competency platform-activity mapping is defensible without
//     product input (LearningBadge/OutreachLog/WorkHistoryEntry activity
//     signals mostly measure the Effort component, not a specific
//     competency), and an honest blank beats a fabricated proxy (§17:
//     "never generate a number the candidate didn't supply").

import 'server-only'
import type { Reference } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeReferenceWeights } from '@/lib/references/collusion-check'
import { scoreToGrade, CATEGORY_ORDER, CATEGORY_LABEL, type CategoryKey, type Grade } from '@/lib/scoring/grade'

export type CompetencyKey = Exclude<CategoryKey, 'targetFit'>
export type CompetencySource = 'reference' | 'assessment' | 'activity'

export const COMPETENCY_ORDER: CompetencyKey[] = CATEGORY_ORDER.filter((k): k is CompetencyKey => k !== 'targetFit')
export const COMPETENCY_LABEL: Record<CompetencyKey, string> = Object.fromEntries(
  COMPETENCY_ORDER.map((k) => [k, CATEGORY_LABEL[k]])
) as Record<CompetencyKey, string>

export const SOURCE_ORDER: CompetencySource[] = ['reference', 'assessment', 'activity']
export const SOURCE_LABEL: Record<CompetencySource, string> = {
  reference: 'References',
  assessment: 'Assessment',
  activity: 'Activity',
}

// A competency shows a letter grade only once 2 of its 3 cells are
// measured (§5.2) — one reference is one opinion, not a measurement.
const MEASURED_THRESHOLD = 2
export const TOTAL_GRID_CELLS = COMPETENCY_ORDER.length * SOURCE_ORDER.length // 15

interface CellResult {
  score: number | null
  measured: boolean
  evidenceRef: string | null
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function rescale(value: number, maxScale: number): number {
  return clamp(((value - 1) / (maxScale - 1)) * 100)
}

// Same reference field per competency dossier-competencies.ts already
// reads (see averageReferenceRating there) — overallRating is the sole 1-4
// scale field, everything else is 1-5.
const REFERENCE_FIELD: Record<CompetencyKey, { field: keyof Reference; maxScale: number }> = {
  leadership: { field: 'traitPresenceRating', maxScale: 5 },
  skillsExecution: { field: 'overallRating', maxScale: 4 },
  communication: { field: 'traitCollaborationRating', maxScale: 5 },
  adaptability: { field: 'traitAdaptabilityRating', maxScale: 5 },
  ownership: { field: 'traitFollowThroughRating', maxScale: 5 },
}

async function computeReferenceCells(candidateId: string): Promise<Record<CompetencyKey, CellResult>> {
  const references = await prisma.reference.findMany({ where: { candidateId, status: 'COMPLETED' } })
  const weights = computeReferenceWeights(references)

  const result = {} as Record<CompetencyKey, CellResult>
  for (const competency of COMPETENCY_ORDER) {
    const { field, maxScale } = REFERENCE_FIELD[competency]
    const weighted = references
      .map((r) => ({ id: r.id, value: r[field] as number | null, weight: weights.get(r.id) ?? 1 }))
      .filter((x): x is { id: string; value: number; weight: number } => x.value !== null && x.value !== undefined)

    if (weighted.length === 0) {
      result[competency] = { score: null, measured: false, evidenceRef: null }
      continue
    }
    const totalWeight = weighted.reduce((sum, x) => sum + x.weight, 0)
    const avg = weighted.reduce((sum, x) => sum + x.value * x.weight, 0) / totalWeight
    // evidenceRef points at the most recent contributing reference — a
    // single traceable id for "what filled this in," not the full set.
    const mostRecent = weighted[weighted.length - 1]
    result[competency] = { score: rescale(avg, maxScale), measured: true, evidenceRef: mostRecent.id }
  }
  return result
}

async function computeAssessmentCells(candidateId: string): Promise<Record<CompetencyKey, CellResult>> {
  const response = await prisma.performanceAssessmentResponse.findFirst({
    where: { candidateId },
    orderBy: { completedAt: 'desc' },
    select: { id: true, executionScore: true, judgmentScore: true, composureScore: true, influenceScore: true },
  })

  const unmeasured: CellResult = { score: null, measured: false, evidenceRef: null }
  if (!response) {
    return {
      leadership: unmeasured,
      skillsExecution: unmeasured,
      communication: unmeasured,
      adaptability: unmeasured,
      ownership: unmeasured,
    }
  }

  const measured = (raw: number): CellResult => ({ score: rescale(raw, 4), measured: true, evidenceRef: response.id })
  return {
    leadership: measured(response.influenceScore),
    skillsExecution: unmeasured, // deliberately no assessment input for Skills & Execution (§4.1)
    communication: measured(response.influenceScore),
    adaptability: measured((response.judgmentScore + response.composureScore) / 2),
    ownership: measured((response.executionScore + response.composureScore) / 2),
  }
}

function computeActivityCells(): Record<CompetencyKey, CellResult> {
  const unmeasured: CellResult = { score: null, measured: false, evidenceRef: null }
  return {
    leadership: unmeasured,
    skillsExecution: unmeasured,
    communication: unmeasured,
    adaptability: unmeasured,
    ownership: unmeasured,
  }
}

// Computes all 15 cells and upserts them — call after a reference completes
// or a How I Perform assessment completes, same "recompute on the event
// that changed it" convention as the market-reality components.
export async function computeCompetencyGrid(candidateId: string): Promise<void> {
  const [referenceCells, assessmentCells] = await Promise.all([
    computeReferenceCells(candidateId),
    computeAssessmentCells(candidateId),
  ])
  const activityCells = computeActivityCells()

  const bySource: Record<CompetencySource, Record<CompetencyKey, CellResult>> = {
    reference: referenceCells,
    assessment: assessmentCells,
    activity: activityCells,
  }

  await prisma.$transaction(
    SOURCE_ORDER.flatMap((source) =>
      COMPETENCY_ORDER.map((competency) => {
        const cell = bySource[source][competency]
        return prisma.competencyScore.upsert({
          where: { candidateId_competency_source: { candidateId, competency, source } },
          create: { candidateId, competency, source, score: cell.score, measured: cell.measured, evidenceRef: cell.evidenceRef },
          update: { score: cell.score, measured: cell.measured, evidenceRef: cell.evidenceRef },
        })
      })
    )
  )
}

export interface CompetencyGridCell {
  source: CompetencySource
  score: number | null
  measured: boolean
}

export interface CompetencyGridRow {
  competency: CompetencyKey
  label: string
  cells: CompetencyGridCell[]
  sourcesMeasured: number
  // Letter grade only once >= MEASURED_THRESHOLD sources are measured
  // (§5.2) — never a grade off a single opinion.
  grade: Grade | null
  averageScore: number | null
}

export interface CompetencyGridDisplay {
  rows: CompetencyGridRow[]
  cellsMeasured: number
  cellsTotal: number
}

// Reads the persisted grid (never computes live — call computeCompetencyGrid
// first) and applies the §5.2 threshold rule. A candidate with no grid rows
// yet (never computed) reads as fully unmeasured, matching §3.6/§5: a
// missing row is exactly the same display state as a measured:false row.
export async function getCompetencyGridDisplay(candidateId: string): Promise<CompetencyGridDisplay> {
  const stored = await prisma.competencyScore.findMany({ where: { candidateId } })
  const byKey = new Map(stored.map((row) => [`${row.competency}:${row.source}`, row]))

  let cellsMeasured = 0
  const rows: CompetencyGridRow[] = COMPETENCY_ORDER.map((competency) => {
    const cells: CompetencyGridCell[] = SOURCE_ORDER.map((source) => {
      const row = byKey.get(`${competency}:${source}`)
      if (row?.measured) cellsMeasured++
      return { source, score: row?.score ?? null, measured: row?.measured ?? false }
    })

    const measuredCells = cells.filter((c) => c.measured && c.score !== null)
    const sourcesMeasured = measuredCells.length
    const averageScore =
      measuredCells.length > 0 ? clamp(measuredCells.reduce((sum, c) => sum + (c.score as number), 0) / measuredCells.length) : null
    const grade = sourcesMeasured >= MEASURED_THRESHOLD && averageScore !== null ? scoreToGrade(averageScore) : null

    return { competency, label: COMPETENCY_LABEL[competency], cells, sourcesMeasured, grade, averageScore }
  })

  return { rows, cellsMeasured, cellsTotal: TOTAL_GRID_CELLS }
}
