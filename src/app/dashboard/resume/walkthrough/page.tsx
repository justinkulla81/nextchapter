import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getOrCreateWalkthroughSession } from '@/lib/walkthrough/session'
import { getMechanicalBatchFindings } from '@/lib/walkthrough/mechanical-findings'
import { findReviewerCorrectionTarget } from '@/lib/walkthrough/reviewer-correction'
import { REVIEWER_DETECTION_CHALLENGE_COPY, type ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'
import type { ReviewerResolutionType, WalkthroughScreen } from '@/lib/walkthrough/types'
import { WalkthroughShell } from '@/components/walkthrough/WalkthroughShell'
import { OverviewStep } from '@/components/walkthrough/OverviewStep'
import { MechanicalFindingStep } from '@/components/walkthrough/MechanicalFindingStep'
import { TargetLineStep } from '@/components/walkthrough/TargetLineStep'
import { GuidedBulletStep } from '@/components/walkthrough/GuidedBulletStep'
import { ReviewerQuestionStep } from '@/components/walkthrough/ReviewerQuestionStep'
import { ReviewSummaryStep } from '@/components/walkthrough/ReviewSummaryStep'

export const metadata: Metadata = { title: 'Resume Fixer' }

// §13.1's ~18-minute estimate for the full guided walkthrough — shown once,
// on the overview screen only.
const ESTIMATED_MINUTES = 18

const STEP_TITLE: Record<WalkthroughScreen['kind'], string> = {
  overview: 'Resume Fixer — fix your resume, one issue at a time',
  mechanical: 'Formatting & ATS check',
  'target-line': 'Your target line',
  bullet: 'Strengthen this bullet',
  reviewer: 'What a reviewer might ask',
  'thin-entry': 'A thin part of your history',
  review: 'Review & summary',
}

export default async function ResumeWalkthroughPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const profile = await getDashboardData()
  const session = await getOrCreateWalkthroughSession(profile.id)
  const { step: stepParam } = await searchParams

  const totalSteps = session.screenPlan.length
  if (totalSteps === 0) return notFound()

  const requestedStep = stepParam !== undefined ? Number(stepParam) : session.currentStep
  const step = Number.isFinite(requestedStep) ? Math.min(Math.max(requestedStep, 0), totalSteps - 1) : session.currentStep

  const screen = session.screenPlan[step]
  if (!screen) return notFound()

  const title = STEP_TITLE[screen.kind]
  let body: React.ReactNode

  switch (screen.kind) {
    case 'overview': {
      body = <OverviewStep nextStep={step + 1} estimatedMinutes={ESTIMATED_MINUTES} />
      break
    }

    case 'mechanical': {
      const findings = await getMechanicalBatchFindings(profile.id)
      const found = findings.find((f) => f.key === screen.key)
      body = found ? (
        <MechanicalFindingStep
          finding={found}
          handledAction={session.stepAnswers.mechanicalHandled?.[screen.key] ?? null}
          nextStep={step + 1}
        />
      ) : (
        <SkippedNotice />
      )
      break
    }

    case 'target-line': {
      const candidate = await prisma.candidateProfile.findUniqueOrThrow({
        where: { id: profile.id },
        select: { positioningStatementDraft: true, positioningStatementText: true },
      })
      body = (
        <TargetLineStep
          draftText={candidate.positioningStatementDraft}
          approvedText={candidate.positioningStatementText}
          nextStep={step + 1}
        />
      )
      break
    }

    case 'bullet': {
      const entry = await prisma.workHistoryEntry.findFirst({
        where: { id: screen.workHistoryEntryId, candidateId: profile.id },
      })
      body = entry ? (
        <GuidedBulletStep
          entry={entry}
          draft={session.stepAnswers.bulletDrafts?.[entry.id] ?? {}}
          handled={Boolean(session.stepAnswers.bulletsHandled?.[entry.id])}
          nextStep={step + 1}
        />
      ) : (
        <SkippedNotice />
      )
      break
    }

    case 'reviewer':
    case 'thin-entry': {
      const question = await prisma.reviewerQuestion.findFirst({
        where: { id: screen.reviewerQuestionId, candidateId: profile.id },
      })
      if (!question) {
        body = <SkippedNotice />
        break
      }
      const detectionType = question.detectionType as ReviewerDetectionType
      const context = (question.detectedContext as Record<string, unknown>) ?? {}
      const copyFn = REVIEWER_DETECTION_CHALLENGE_COPY[detectionType]
      const challengeCopy = copyFn
        ? copyFn(context)
        : 'We flagged something on your resume worth a second look. Is that right?'
      const correctionTarget = await findReviewerCorrectionTarget(profile.id, detectionType, context)
      const existingResolution =
        (session.stepAnswers.reviewerHandled?.[question.id]?.resolutionType as ReviewerResolutionType | undefined) ??
        (question.resolutionType as ReviewerResolutionType | null) ??
        null

      body = (
        <ReviewerQuestionStep
          questionId={question.id}
          detectionType={detectionType}
          challengeCopy={challengeCopy}
          correctionTarget={correctionTarget}
          stepLabel={screen.kind === 'thin-entry' ? 'thin-entry' : 'reviewer-questions'}
          nextStep={step + 1}
          existingResolution={existingResolution}
        />
      )
      break
    }

    case 'review': {
      body = <ReviewSummaryStep candidateId={profile.id} stepAnswers={session.stepAnswers} />
      break
    }
  }

  return (
    <WalkthroughShell step={step} totalSteps={totalSteps} title={title}>
      {body}
    </WalkthroughShell>
  )
}

// Data the screen plan pointed at (a finding/role/detection) no longer
// exists — e.g. the candidate deleted that work-history row mid-walkthrough
// from another tab. Rather than crash, say so plainly; the candidate can
// use the progress bar's implicit "back" (browser back button) or just
// keep going once they land on a real step again via the URL's step param.
function SkippedNotice() {
  return <p className="text-sm text-muted-foreground">This item is no longer available — it may have changed since you started. You can continue to the next step using your browser&apos;s back button and the step link, or start over from the resume page.</p>
}
