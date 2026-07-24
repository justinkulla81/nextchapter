import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { generateEvidenceBrief } from '@/lib/reports/evidence-brief'
import { getDueOutcomeWindow, OUTCOME_WINDOW_LABEL } from '@/lib/talent/outcome-ratings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EvidenceTypeBadge } from '@/components/dashboard/EvidenceTypeBadge'
import { SubmitButton } from '@/components/ui/submit-button'
import { markCandidateHired, submitOutcomeRating } from './actions'

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
    </div>
  )
}
