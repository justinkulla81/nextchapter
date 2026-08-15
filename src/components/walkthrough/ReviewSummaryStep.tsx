import { prisma } from '@/lib/prisma'
import { getMechanicalBatchFindings } from '@/lib/walkthrough/mechanical-findings'
import { REVIEWER_DETECTION_CHALLENGE_COPY, type ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'
import type { WalkthroughStepAnswers } from '@/lib/walkthrough/types'
import { Check, Circle, X } from 'lucide-react'
import { restartWalkthroughAction } from '@/app/dashboard/resume/walkthrough/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// §13.1's walkthrough deliberately ends here in this pass — no reformat/
// export step. Zero document-generation infra exists in this codebase today
// (no docx/pdfkit/@react-pdf/renderer in package.json, confirmed), and
// reformat/export is being scoped separately as its own infra decision.
// Rather than a fake, dead "Export" button, this is an honestly-labeled,
// non-interactive placeholder.
export async function ReviewSummaryStep({ candidateId, stepAnswers }: { candidateId: string; stepAnswers: WalkthroughStepAnswers }) {
  const [mechanicalFindings, candidate, bulletEntries, reviewerQuestionRows, latestAnalysis] = await Promise.all([
    getMechanicalBatchFindings(candidateId),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { positioningStatementText: true },
    }),
    prisma.workHistoryEntry.findMany({
      where: { id: { in: Object.keys(stepAnswers.bulletsHandled ?? {}) } },
      select: { id: true, roleTitle: true, companyName: true, keyAchievement: true },
    }),
    prisma.reviewerQuestion.findMany({
      where: { id: { in: Object.keys(stepAnswers.reviewerHandled ?? {}) } },
    }),
    // Doesn't depend on anything else in this batch — pulled forward from
    // its own sequential await below `stillActive`'s query still has to
    // wait on this one (it needs the id), but this no longer waits on the
    // other four.
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ])

  const mechanicalFixed = mechanicalFindings.filter((f) => stepAnswers.mechanicalHandled?.[f.key] === 'fixed')
  const mechanicalSkipped = mechanicalFindings.filter((f) => stepAnswers.mechanicalHandled?.[f.key] === 'skipped')

  const bulletsComposed = bulletEntries.filter((e) => e.keyAchievement && stepAnswers.bulletsHandled?.[e.id])

  const corrected = reviewerQuestionRows.filter((q) => stepAnswers.reviewerHandled?.[q.id]?.resolutionType === 'CORRECTED')
  const notApplicable = reviewerQuestionRows.filter(
    (q) => stepAnswers.reviewerHandled?.[q.id]?.resolutionType === 'NOT_APPLICABLE'
  )
  const leftAsIs = reviewerQuestionRows.filter((q) => stepAnswers.reviewerHandled?.[q.id]?.resolutionType === 'LEAVE_AS_IS')

  // Honesty check: any active detection this walkthrough never even offered
  // (more than the two-plus-thin-entry cap) still belongs in "still open."
  const stillActive = latestAnalysis
    ? await prisma.reviewerQuestion.findMany({
        where: { resumeAnalysisId: latestAnalysis.id, resolvedAt: null },
      })
    : []

  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground">Here&apos;s what changed, and what&apos;s still open.</p>

      <SummarySection title="Mechanical fixes">
        {mechanicalFixed.length === 0 && mechanicalSkipped.length === 0 ? (
          <EmptyLine>No formatting or ATS issues found.</EmptyLine>
        ) : (
          <>
            {mechanicalFixed.map((f) => (
              <SummaryLine key={f.key} icon="fixed" text={f.finding.candidateFacingCopy} />
            ))}
            {mechanicalSkipped.map((f) => (
              <SummaryLine key={f.key} icon="open" text={f.finding.candidateFacingCopy} />
            ))}
          </>
        )}
      </SummarySection>

      <SummarySection title="Target line">
        {candidate?.positioningStatementText ? (
          <SummaryLine icon="fixed" text={candidate.positioningStatementText} />
        ) : (
          <EmptyLine>Not set yet.</EmptyLine>
        )}
      </SummarySection>

      <SummarySection title="Guided bullets">
        {bulletsComposed.length === 0 ? (
          <EmptyLine>No bullets composed this session.</EmptyLine>
        ) : (
          bulletsComposed.map((e) => (
            <SummaryLine key={e.id} icon="fixed" text={`${e.roleTitle} · ${e.companyName}: ${e.keyAchievement}`} />
          ))
        )}
      </SummarySection>

      <SummarySection title="Reviewer questions">
        {corrected.length === 0 && notApplicable.length === 0 && leftAsIs.length === 0 && stillActive.length === 0 ? (
          <EmptyLine>Nothing flagged for a reviewer to ask about.</EmptyLine>
        ) : (
          <>
            {corrected.map((q) => (
              <SummaryLine key={q.id} icon="fixed" text={describe(q.detectionType, q.detectedContext)} />
            ))}
            {notApplicable.map((q) => (
              <SummaryLine key={q.id} icon="dismissed" text={describe(q.detectionType, q.detectedContext)} />
            ))}
            {leftAsIs.map((q) => (
              <SummaryLine key={q.id} icon="open" text={describe(q.detectionType, q.detectedContext)} />
            ))}
            {stillActive.map((q) => (
              <SummaryLine key={q.id} icon="open" text={describe(q.detectionType, q.detectedContext)} />
            ))}
          </>
        )}
      </SummarySection>

      <div className="space-y-1 rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium text-muted-foreground">Reformat &amp; export — coming soon</p>
        <p className="text-xs text-muted-foreground">
          A parse-safe template export isn&apos;t built yet. Everything above is already saved to your profile.
        </p>
      </div>

      <form action={restartWalkthroughAction}>
        <SubmitButton variant="outline" size="sm" pendingLabel="Starting…">
          Start a new walkthrough
        </SubmitButton>
      </form>
    </div>
  )
}

function describe(detectionType: string, detectedContext: unknown): string {
  const copyFn = REVIEWER_DETECTION_CHALLENGE_COPY[detectionType as ReviewerDetectionType]
  if (!copyFn) return detectionType
  return copyFn((detectedContext as Record<string, unknown>) ?? {})
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function SummaryLine({ icon, text }: { icon: 'fixed' | 'dismissed' | 'open'; text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-foreground">
      {icon === 'fixed' && <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />}
      {icon === 'dismissed' && <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      {icon === 'open' && <Circle className="mt-0.5 size-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden />}
      <span>{text}</span>
    </p>
  )
}
