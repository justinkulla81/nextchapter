// Explodes one completed ResumeAnalysis into ResumeIssue rows — Phase 2
// Master Script, Part B, Prompt 3. Called from resume-analysis/compute.ts
// right after `prisma.resumeAnalysis.create()` succeeds, since that's the
// one place all three source shapes (dimensionFindings, the reconciliation
// modifier's findings, and the just-created ReviewerQuestion rows) are
// already in scope in the same request — computeResumeAnalysis()'s public
// return type doesn't carry any of them back out to its caller
// (src/app/dashboard/resume/actions.ts), so doing this as a separate
// post-return step would mean re-deriving data that's already sitting
// right here.
//
// Never deletes rows on re-upload (Prompt 3: "Never delete rows on
// re-upload"). Before inserting the new batch, any still-unresolved
// ResumeIssue row left over from a PRIOR ResumeAnalysis for this candidate
// is marked resolutionType: 'superseded' — a new analysis always creates a
// fresh Resume + ResumeAnalysis row (see actions.ts's uploadResume), so
// "prior analysis for this candidate" is exactly the right scope, not
// "prior analysis for this resumeId" (there is no such thing — every
// upload gets a new resumeId).

import 'server-only'
import type { Prisma, ReviewerQuestion } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ISSUE_TAXONOMY,
  REVIEWER_DETECTION_TYPE_TO_ISSUE_CODE,
  mapFindingSeverityToIssueSeverity,
  type ReviewerDetectionTypeForTaxonomy,
} from '@/lib/analytics/issue-taxonomy'
import type { DimensionFindings, DimensionKey } from '@/lib/scoring/resume-analysis/types'
import type { ReconciliationFinding } from '@/lib/scoring/resume-analysis/modifiers'

export interface CaptureResumeIssuesInput {
  candidateId: string
  resumeAnalysisId: string
  dimensionFindings: DimensionFindings
  reconciliationFindings: ReconciliationFinding[]
  // Only the two fields this module reads — accepts the rows Prisma hands
  // back from resumeAnalysis.create()'s `include: { reviewerQuestions: true }`.
  reviewerQuestions: Pick<ReviewerQuestion, 'id' | 'detectionType'>[]
}

export async function captureResumeIssues(input: CaptureResumeIssuesInput): Promise<void> {
  const rows: Prisma.ResumeIssueCreateManyInput[] = []

  for (const dimensionKey of Object.keys(input.dimensionFindings) as DimensionKey[]) {
    const findings = input.dimensionFindings[dimensionKey] ?? []
    findings.forEach((finding, index) => {
      const entry = ISSUE_TAXONOMY[finding.issueCode]
      rows.push({
        candidateId: input.candidateId,
        resumeAnalysisId: input.resumeAnalysisId,
        issueCode: finding.issueCode,
        category: entry.category,
        severity: mapFindingSeverityToIssueSeverity(finding.severity),
        dimension: entry.dimension,
        pointImpact: finding.estimatedPointGain,
        // Matches walkthrough/mechanical-findings.ts's `${dimension}:${index}`
        // key exactly, so resolveMechanicalFindingAction can find this row.
        findingKey: `${dimensionKey}:${index}`,
      })
    })
  }

  input.reconciliationFindings.forEach((finding, index) => {
    const entry = ISSUE_TAXONOMY[finding.issueCode]
    rows.push({
      candidateId: input.candidateId,
      resumeAnalysisId: input.resumeAnalysisId,
      issueCode: finding.issueCode,
      category: entry.category,
      // ReconciliationFinding carries no per-instance severity (unlike
      // Finding) — fall back to the taxonomy's typical severity for the code.
      severity: entry.severity,
      dimension: entry.dimension,
      pointImpact: Math.abs(finding.penalty),
      findingKey: `reconciliation:${index}`,
    })
  })

  for (const reviewerQuestion of input.reviewerQuestions) {
    const issueCode =
      REVIEWER_DETECTION_TYPE_TO_ISSUE_CODE[reviewerQuestion.detectionType as ReviewerDetectionTypeForTaxonomy]
    const entry = ISSUE_TAXONOMY[issueCode]
    rows.push({
      candidateId: input.candidateId,
      resumeAnalysisId: input.resumeAnalysisId,
      issueCode,
      category: entry.category,
      // ReviewerDetection carries no per-instance severity either — same
      // taxonomy-default fallback as the reconciliation branch above.
      severity: entry.severity,
      dimension: entry.dimension,
      // No per-instance point estimate exists for a reviewer-question
      // detection — leaving this null (rather than backfilling
      // typicalPointImpact) keeps ResumeIssue.pointImpact meaning "a real
      // measured estimate" everywhere it's non-null.
      pointImpact: null,
      reviewerQuestionId: reviewerQuestion.id,
    })
  }

  if (rows.length === 0) return

  await prisma.resumeIssue.updateMany({
    where: {
      candidateId: input.candidateId,
      resolvedAt: null,
      resumeAnalysisId: { not: input.resumeAnalysisId },
    },
    data: { resolvedAt: new Date(), resolutionType: 'superseded' },
  })

  await prisma.resumeIssue.createMany({ data: rows })
}
