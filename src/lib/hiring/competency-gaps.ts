import 'server-only'
import { getCompetencyGridDisplay, COMPETENCY_LABEL, type CompetencyKey } from '@/lib/scoring/competency-grid'
import { computeNamedReasons, type NamedReason } from '@/lib/scoring/named-reasons'
import { computeCategoryGrades, GRADE_RELATIONS_INCLUDE, type CandidateWithGradeRelations } from '@/lib/scoring/dossier-competencies'
import { prisma } from '@/lib/prisma'

// Shared gap-detection primitive for both the LLM interview-guide generator
// (generate-interview-guide.ts) and the rule-based reference-question
// derivation (reference-questions.ts) — one definition of "what's a gap"
// so the two don't quietly drift apart. Deliberately QUALITATIVE only: a
// CompetencyGap never carries the underlying numeric score or letter grade,
// only whether reference/assessment evidence exists — §A8/§E4.1's "never
// Market Reality Grade, component grades, detections, or badges" rule
// applies to every hiring-manager-facing surface this feeds, so the
// boundary is enforced right here at the source rather than trusted to
// every caller downstream.
export interface CompetencyGap {
  competency: CompetencyKey
  label: string
  referenceThin: boolean // no completed reference speaks to this competency
  assessmentThin: boolean // no How I Work Best result speaks to this competency
  narrativeGapText: string | null // the named-reason gap copy, when this competency graded low enough to have one
}

export async function getCompetencyGaps(candidateId: string): Promise<CompetencyGap[]> {
  const [grid, candidate] = await Promise.all([
    getCompetencyGridDisplay(candidateId),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, include: GRADE_RELATIONS_INCLUDE }),
  ])

  let namedReasons: NamedReason[] = []
  if (candidate) {
    const categories = await computeCategoryGrades(candidate as unknown as CandidateWithGradeRelations)
    namedReasons = computeNamedReasons(categories, null, {
      jobHoppingFlag: candidate.jobHoppingFlag,
      careerTrajectory: candidate.careerTrajectory,
      gapDuration: candidate.gapDuration,
    })
  }
  const gapTextByCategory = new Map(namedReasons.filter((r) => r.kind === 'gap').map((r) => [r.category, r.text]))

  return grid.rows.map((row) => {
    const referenceCell = row.cells.find((c) => c.source === 'reference')
    const assessmentCell = row.cells.find((c) => c.source === 'assessment')
    return {
      competency: row.competency,
      label: COMPETENCY_LABEL[row.competency],
      referenceThin: !referenceCell?.measured,
      assessmentThin: !assessmentCell?.measured,
      narrativeGapText: gapTextByCategory.get(row.competency) ?? null,
    }
  })
}

// Competencies genuinely worth probing further — either evidence source is
// thin, or there's a named narrative gap. Used to focus both generators on
// what actually needs asking rather than every competency uniformly.
export function competenciesNeedingEvidence(gaps: CompetencyGap[]): CompetencyGap[] {
  return gaps.filter((g) => g.referenceThin || g.assessmentThin || g.narrativeGapText !== null)
}
