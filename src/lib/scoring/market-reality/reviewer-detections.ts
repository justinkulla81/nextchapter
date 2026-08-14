// Reviewer-detection surfacing — Market Reality Grade 2.0 Phase 4. The
// detections themselves are computed and persisted in Phase 2
// (resume-analysis/reviewer-questions.ts + compute.ts, on ResumeAnalysis
// create). This module is the read/resolve surface Phase 6/7 will build the
// "How a recruiter will read this" section and its Search Action Tasks on.
//
// Explanation-neutralizes-detection, never-reduces-penalty invariant
// (Resume Scoring Spec): recording candidateExplanation removes the
// detection from what a reviewer sees, but the Reconciliation & Integrity
// penalty already baked into ResumeAnalysis.reconciliationPenalty is a
// separate, permanent number — resolving a detection here never touches it.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { REVIEWER_DETECTION_FOLLOWUP, type ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'

export interface ActiveReviewerDetection {
  id: string
  detectionType: ReviewerDetectionType
  detectedContext: Record<string, unknown>
  followUpPrompt: string
}

// Unresolved detections tied to the candidate's LATEST resume analysis
// only — an older analysis's detections are stale once a new resume has
// been scored, even if the candidate never explained them.
export async function getActiveReviewerDetections(candidateId: string): Promise<ActiveReviewerDetection[]> {
  const latestAnalysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (!latestAnalysis) return []

  const rows = await prisma.reviewerQuestion.findMany({
    where: { resumeAnalysisId: latestAnalysis.id, candidateExplanation: null, resolvedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((r) => ({
    id: r.id,
    detectionType: r.detectionType as ReviewerDetectionType,
    detectedContext: r.detectedContext as Record<string, unknown>,
    followUpPrompt: REVIEWER_DETECTION_FOLLOWUP[r.detectionType as ReviewerDetectionType],
  }))
}

// Records the candidate's one-line explanation and marks the detection
// resolved. Deliberately does NOT touch ResumeAnalysis.reconciliationPenalty
// — see module header.
export async function resolveReviewerDetection(id: string, candidateExplanation: string): Promise<void> {
  await prisma.reviewerQuestion.update({
    where: { id },
    data: { candidateExplanation, resolvedAt: new Date() },
  })
}
