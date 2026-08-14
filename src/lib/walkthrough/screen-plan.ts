// Builds the candidate-specific, ordered screen list for one walkthrough
// session — computed once (see session.ts's getOrCreateWalkthroughSession)
// and never recomputed in place, so the step pointer stays valid even as
// findings/detections get resolved mid-walk. §13.1's fixed 12-step outline
// (overview -> mechanical batch -> target line -> five guided bullets ->
// two reviewer questions -> thin entry -> ...) becomes a variable-length
// plan here because the number of mechanical findings, bullet candidates,
// and active reviewer detections all vary per candidate — a candidate with
// nothing to fix on a given step simply has no screen for it.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMechanicalBatchFindings } from './mechanical-findings'
import { getGuidedBulletCandidates } from './bullet-candidates'
import type { WalkthroughScreen } from './types'

// §13.1 calls for "two reviewer questions" specifically, to keep the whole
// walkthrough to ~18 minutes — if more than two detections are active, the
// rest stay unaddressed by this pass but still show up, honestly, in the
// review-summary screen's "still open" list (see ReviewSummaryStep).
const MAX_REVIEWER_QUESTION_SCREENS = 2

export async function buildScreenPlan(candidateId: string): Promise<WalkthroughScreen[]> {
  const [mechanicalFindings, bulletCandidates, latestAnalysis] = await Promise.all([
    getMechanicalBatchFindings(candidateId),
    getGuidedBulletCandidates(candidateId),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ])

  const activeDetections = latestAnalysis
    ? await prisma.reviewerQuestion.findMany({
        where: { resumeAnalysisId: latestAnalysis.id, resolvedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const thinEntry = activeDetections.find((d) => d.detectionType === 'THIN_RECENT_ENTRY')
  const otherDetections = activeDetections
    .filter((d) => d.detectionType !== 'THIN_RECENT_ENTRY')
    .slice(0, MAX_REVIEWER_QUESTION_SCREENS)

  return [
    { kind: 'overview' },
    ...mechanicalFindings.map((f): WalkthroughScreen => ({ kind: 'mechanical', key: f.key })),
    { kind: 'target-line' },
    ...bulletCandidates.map((entry): WalkthroughScreen => ({ kind: 'bullet', workHistoryEntryId: entry.id })),
    ...otherDetections.map((d): WalkthroughScreen => ({ kind: 'reviewer', reviewerQuestionId: d.id })),
    ...(thinEntry ? [{ kind: 'thin-entry' as const, reviewerQuestionId: thinEntry.id }] : []),
    { kind: 'review' },
  ]
}
