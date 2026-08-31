import { prisma } from '@/lib/prisma'
import { getMechanicalBatchFindings } from '@/lib/walkthrough/mechanical-findings'
import { REVIEWER_DETECTION_CHALLENGE_COPY, type ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'
import type { WalkthroughStepAnswers } from '@/lib/walkthrough/types'
import { Check, Circle, X } from 'lucide-react'
import { restartWalkthroughAction } from '@/app/dashboard/resume/walkthrough/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { buildResumeDocumentData, type ResumeDocumentData } from '@/lib/resume/export/document-data'
import { ResumeExportForm } from '@/components/dashboard/ResumeExportForm'

export async function ReviewSummaryStep({ candidateId, stepAnswers }: { candidateId: string; stepAnswers: WalkthroughStepAnswers }) {
  const [mechanicalFindings, candidate, bulletEntries, reviewerQuestionRows, latestAnalysis, resumeDocument] = await Promise.all([
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
    // Pulls straight from CandidateProfile/WorkHistoryEntry/EducationEntry
    // at read time (buildResumeDocumentData), so it already reflects
    // everything this walkthrough just changed (approveTargetLineAction
    // writes positioningStatementText, composeBulletAction writes
    // keyAchievement) with no session-data plumbing needed.
    buildResumeDocumentData(candidateId),
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

      <SummarySection title="Your new resume">
        <ResumePreview data={resumeDocument} />
      </SummarySection>

      <ResumeExportForm />

      <form action={restartWalkthroughAction}>
        <SubmitButton variant="outline" size="sm" pendingLabel="Starting…">
          Start the Resume Fixer again
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

// Plain-text read of exactly what ResumeExportForm's download will contain
// — the same buildResumeDocumentData source both draw from, so this can
// never show something the actual file doesn't. A quick "does this look
// right" check before spending a download on it, not a styled substitute
// for one of the real templates.
function ResumePreview({ data }: { data: ResumeDocumentData }) {
  const contactLine = [data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedinUrl]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
      <div>
        <p className="font-semibold text-foreground">{data.name}</p>
        {data.targetTitle && <p className="text-muted-foreground">{data.targetTitle}</p>}
        {contactLine && <p className="text-xs text-muted-foreground">{contactLine}</p>}
      </div>

      {data.summary && <p className="text-foreground">{data.summary}</p>}

      {data.workHistory.length > 0 && (
        <div className="space-y-3">
          {data.workHistory.map((item, i) => (
            <div key={i}>
              <p className="font-medium text-foreground">
                {item.roleTitle} · {item.companyName}
              </p>
              <p className="text-xs text-muted-foreground">{item.dateRangeLabel}</p>
              {item.bullets.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {item.bullets.map((bullet, j) => (
                    <li key={j}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {data.skills.length > 0 && (
        <p>
          <span className="font-medium text-foreground">Skills: </span>
          <span className="text-muted-foreground">{data.skills.join(', ')}</span>
        </p>
      )}
    </div>
  )
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
