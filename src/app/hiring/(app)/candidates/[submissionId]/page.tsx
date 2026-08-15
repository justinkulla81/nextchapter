import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { getVisibleSubmissionForHiringManager } from '@/lib/hiring/visibility'
import { buildHiringDossierView } from '@/lib/hiring/dossier-view'
import { getReferenceQuestions } from '@/lib/hiring/reference-questions'
import { getPanel } from '@/lib/hiring/panels'
import { getScorecardComparison } from '@/lib/hiring/scorecards'
import { CATEGORY_LABEL, type CategoryKey } from '@/lib/scoring/grade'
import { getPostHireFeedback } from '@/lib/hiring/post-hire-feedback'
import { STAGE_LABEL } from '@/lib/recruiter/submission-stages'
import { GenerateGuideButton } from '@/components/hiring/GenerateGuideButton'
import { PanelSetupForm, PanelAssignments } from '@/components/hiring/PanelSetupForm'
import { ScorecardComparisonTable } from '@/components/hiring/ScorecardComparisonTable'
import { PostHireFeedbackForm } from '@/components/hiring/PostHireFeedbackForm'
import { ConflictDeclareForm } from '@/components/hiring/ConflictDeclareForm'

export default async function HiringCandidateDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params
  const hiringManager = await getCurrentHiringManager()
  const submission = await getVisibleSubmissionForHiringManager(submissionId, hiringManager.id)
  if (!submission) notFound()

  const [dossier, referenceQuestions, guide, panel, scorecardRows, postHireFeedback, headersList] = await Promise.all([
    buildHiringDossierView(submission.candidateId),
    getReferenceQuestions(submission.candidateId),
    prisma.interviewGuide.findUnique({ where: { submissionId } }),
    getPanel(submissionId),
    getScorecardComparison(submissionId),
    getPostHireFeedback(submissionId, hiringManager.id),
    headers(),
  ])

  if (!dossier) notFound()

  const siteOrigin = `${headersList.get('x-forwarded-proto') ?? 'https'}://${headersList.get('host') ?? ''}`
  const candidateQuestions = (guide?.candidateQuestions as { competency: string | null; question: string; rationale: string }[] | null) ?? []

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dossier.candidateName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {submission.roleTitle} at {submission.companyName} ·{' '}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {STAGE_LABEL[submission.stage]}
            </span>
          </p>
        </div>
        <ConflictDeclareForm submissionId={submissionId} />
      </div>

      {/* §A8 item 1 — the allowlisted Dossier view. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Dossier</h2>
        {dossier.positioningStatement && <p className="text-sm text-foreground">{dossier.positioningStatement}</p>}
        {dossier.categoryStrengths.length > 0 && (
          <div className="space-y-1.5">
            {dossier.categoryStrengths.map((s) => (
              <p key={s.label} className="text-sm">
                <span className="font-medium text-foreground">{s.label}:</span> <span className="text-muted-foreground">{s.text}</span>
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {dossier.referenceCount} reference{dossier.referenceCount === 1 ? '' : 's'} · {dossier.hiringManagerCallAvailableCount}{' '}
          available for a hiring-manager call
        </p>
      </section>

      {/* §A8 item 2 — generated interview guide from Dossier gaps. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Interview guide</h2>
          <GenerateGuideButton submissionId={submissionId} hasGuide={Boolean(guide?.generatedAt)} />
        </div>
        {guide?.generationError && !guide.generatedAt && <p className="text-sm text-destructive">{guide.generationError}</p>}
        {candidateQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guide generated yet.</p>
        ) : (
          <div className="space-y-3">
            {candidateQuestions.map((q, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.competency ? (CATEGORY_LABEL[q.competency as CategoryKey] ?? q.competency) : 'Narrative gap'} — {q.rationale}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* §A8 item 5 — reference questions worth asking, rule-based. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Questions worth asking references</h2>
        {referenceQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every competency already has reference evidence — no additional reference questions suggested.
          </p>
        ) : (
          <div className="space-y-3">
            {referenceQuestions.map((q, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">{q.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* §A8 item 3/4 — panel coordination + structured scorecards. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Interview panel</h2>
        {!panel ? (
          <PanelSetupForm submissionId={submissionId} />
        ) : (
          <PanelAssignments panelists={panel.panelists} siteOrigin={siteOrigin} />
        )}
      </section>

      {panel && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Scorecard comparison</h2>
          <ScorecardComparisonTable rows={scorecardRows} />
        </section>
      )}

      {/* §A8 item 6 — 90-day post-hire feedback, once placed. */}
      {submission.stage === 'PLACED' && postHireFeedback && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">90-day post-hire feedback</h2>
          {postHireFeedback.submittedAt ? (
            <p className="text-sm text-muted-foreground">
              Submitted — rated {postHireFeedback.howIsItGoingRating}/5, would hire again:{' '}
              {postHireFeedback.wouldHireAgain ? 'yes' : 'no'}.
            </p>
          ) : (
            <PostHireFeedbackForm submissionId={submissionId} />
          )}
        </section>
      )}
    </div>
  )
}
