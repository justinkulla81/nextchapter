import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { generateEvidenceBrief } from '@/lib/reports/evidence-brief'
import { getDueOutcomeWindow, OUTCOME_WINDOW_LABEL } from '@/lib/talent/outcome-ratings'
import { CATEGORY_LABEL, type CategoryKey } from '@/lib/scoring/grade'
import { getEligibleSubmissionForEmployerCandidate } from '@/lib/talent/submission-match'
import { getReferenceQuestions } from '@/lib/talent/reference-questions'
import { getPanel } from '@/lib/talent/panels'
import { getScorecardComparison } from '@/lib/talent/scorecards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EvidenceTypeBadge } from '@/components/dashboard/EvidenceTypeBadge'
import { SubmitButton } from '@/components/ui/submit-button'
import { PanelSetupForm, PanelAssignments } from '@/components/talent/PanelSetupForm'
import { ScorecardComparisonTable } from '@/components/talent/ScorecardComparisonTable'
import {
  markCandidateHired,
  submitOutcomeRating,
  startMessagingCandidate,
  generateInterviewGuideAction,
  createPanelAction,
} from './actions'

export default async function CandidateEvidenceBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  const interaction = await prisma.candidateInteraction.findUnique({
    where: { employerId_candidateId: { employerId: employer.id, candidateId: id } },
  })
  if (!interaction) notFound()

  const brief = await generateEvidenceBrief(id, employer.id, interaction.roleId ?? undefined)
  if (!brief) notFound()

  const dueWindow = getDueOutcomeWindow(interaction)

  // Interview panel / scorecard setup — only offered when a recruiter has
  // actually submitted this candidate for a role at this employer's
  // company (see src/lib/talent/submission-match.ts). Most Candidate Inbox
  // entries never came through a recruiter submission, so this section is
  // absent for those, same as it was effectively unreachable for most
  // candidates under the retired Hiring Manager portal.
  const submission = await getEligibleSubmissionForEmployerCandidate(employer.id, id)
  let guide: Awaited<ReturnType<typeof prisma.interviewGuide.findUnique>> = null
  let panel: Awaited<ReturnType<typeof getPanel>> = null
  let scorecardRows: Awaited<ReturnType<typeof getScorecardComparison>> = []
  let referenceQuestions: Awaited<ReturnType<typeof getReferenceQuestions>> = []
  let siteOrigin = ''
  if (submission) {
    const [guideResult, panelResult, scorecardResult, referenceQuestionsResult, headersList] = await Promise.all([
      prisma.interviewGuide.findUnique({ where: { submissionId: submission.id } }),
      getPanel(submission.id),
      getScorecardComparison(submission.id),
      getReferenceQuestions(id),
      headers(),
    ])
    guide = guideResult
    panel = panelResult
    scorecardRows = scorecardResult
    referenceQuestions = referenceQuestionsResult
    siteOrigin = `${headersList.get('x-forwarded-proto') ?? 'https'}://${headersList.get('host') ?? ''}`
  }
  const candidateQuestions = (guide?.candidateQuestions as { competency: string | null; question: string; rationale: string }[] | null) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.candidateName}</h1>
        <p className="mt-1 text-muted-foreground">
          {[brief.availability.highestLevelReached, brief.availability.primaryFunction].filter(Boolean).join(' · ')}
        </p>
        {brief.approvalPending && (
          <p className="mt-2 text-sm text-muted-foreground">
            This candidate hasn&apos;t approved revealing their full identity yet — you&apos;re seeing an
            anonymized profile until they do.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">What they&apos;ve done</CardTitle>
          <EvidenceTypeBadge type="self_reported" />
        </CardHeader>
        <CardContent className="space-y-3">
          {brief.workHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work history logged yet.</p>
          ) : (
            brief.workHistory.map((w, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-foreground">
                  {w.roleTitle} at {w.companyName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.startDate.getFullYear()} – {w.isCurrent ? 'Present' : w.endDate?.getFullYear()}
                </p>
                {w.keyAchievement && <p className="mt-1 text-sm text-foreground">{w.keyAchievement}</p>}
              </div>
            ))
          )}
          {brief.workSamples.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
              {s.outcome && <p className="mt-1 text-sm text-foreground">{s.outcome}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Effort & motivation signal</CardTitle>
          <EvidenceTypeBadge type="verified_fact" />
        </CardHeader>
        <CardContent>
          {brief.effortSummaryLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logged activity yet.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
              {brief.effortSummaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {brief.whyTheyMightFit && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Why they might fit</CardTitle>
            <EvidenceTypeBadge type={brief.whyTheyMightFitEvidenceType} />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{brief.whyTheyMightFit}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">What&apos;s uncertain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {brief.gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notable gaps identified.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
              {brief.gaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          )}
          {brief.questionsWorthAsking.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">3 questions worth asking</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground">
                {brief.questionsWorthAsking.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Next step</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            {brief.availability.statusLabel ?? 'Availability not specified'}
            {brief.availability.targetRoleType ? ` · Looking for ${brief.availability.targetRoleType}` : ''}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {brief.approvalPending
              ? 'Waiting on the candidate to approve revealing their full identity before you can reach out directly.'
              : 'This candidate has approved sharing their full identity with you — reach out directly when ready.'}
          </p>
          {!brief.approvalPending && (
            <form action={startMessagingCandidate.bind(null, id)} className="mt-3">
              <SubmitButton pendingLabel="Opening…" size="sm">
                Message candidate
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Hiring outcome</CardTitle>
        </CardHeader>
        <CardContent>
          {!interaction.hiredAt ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                If you hired this candidate, mark it here — it starts the 30/90/180-day check-in prompts
                that feed your hiring analytics.
              </p>
              <form action={markCandidateHired.bind(null, id)}>
                <SubmitButton pendingLabel="Marking as hired…" variant="outline" size="sm">
                  Mark as hired
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-foreground">Hired on {interaction.hiredAt.toLocaleDateString()}</p>
              {dueWindow ? (
                <form action={submitOutcomeRating.bind(null, id, dueWindow)} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{OUTCOME_WINDOW_LABEL[dueWindow]}</p>
                  <p className="text-sm text-muted-foreground">How&apos;s this hire working out, 1-5?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((point) => (
                      <label key={point} className="flex-1">
                        <input type="radio" name="rating" value={point} className="peer sr-only" required />
                        <span className="flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-border text-sm font-semibold text-foreground transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white hover:border-brand/50">
                          {point}
                        </span>
                      </label>
                    ))}
                  </div>
                  <SubmitButton pendingLabel="Saving…" size="sm">
                    Submit rating
                  </SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">No check-in due right now.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interview panel / scorecard setup — ported from the retired Hiring
          Manager portal (§A8) as part of the /hiring -> /talent
          consolidation. Only shown when a recruiter submission ties this
          candidate to this employer's company — see
          getEligibleSubmissionForEmployerCandidate. */}
      {submission && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Interview guide</CardTitle>
              <form action={generateInterviewGuideAction.bind(null, id, submission.id)}>
                <SubmitButton size="sm" variant={guide?.generatedAt ? 'outline' : 'default'} pendingLabel="Generating…">
                  {guide?.generatedAt ? 'Regenerate guide' : 'Generate interview guide'}
                </SubmitButton>
              </form>
            </CardHeader>
            <CardContent className="space-y-3">
              {guide?.generationError && !guide.generatedAt && <p className="text-sm text-destructive">{guide.generationError}</p>}
              {candidateQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guide generated yet.</p>
              ) : (
                candidateQuestions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{q.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.competency ? (CATEGORY_LABEL[q.competency as CategoryKey] ?? q.competency) : 'Narrative gap'} — {q.rationale}
                    </p>
                  </div>
                ))
              )}
              {referenceQuestions.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-sm font-medium text-foreground">Questions worth asking references</p>
                  {referenceQuestions.map((q, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{q.question}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{q.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Interview panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!panel ? (
                <PanelSetupForm action={createPanelAction.bind(null, id, submission.id)} />
              ) : (
                <PanelAssignments panelists={panel.panelists} siteOrigin={siteOrigin} />
              )}
            </CardContent>
          </Card>

          {panel && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Scorecard comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ScorecardComparisonTable rows={scorecardRows} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
