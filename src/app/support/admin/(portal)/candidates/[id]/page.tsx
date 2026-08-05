import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { listAllAuthUsers } from '@/lib/admin/auth-users'
import { getAdminCandidateDetail } from '@/lib/admin/candidate-detail'
import { prisma } from '@/lib/prisma'
import { rankPendingPostingsForCandidate, type AdminFitCandidate } from '@/lib/jobs/job-fit-bucket'
import { displayJobLocation } from '@/lib/jobs/us-location'
import { approveJobPosting } from '@/app/support/admin/(portal)/exclusive-jobs/actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { MotivationChart } from '@/components/dashboard/MotivationChart'

export const maxDuration = 30

async function loadJobRecommendations(candidateId: string) {
  const [candidate, pendingPostings] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        primaryFunction: true,
        secondaryFunction: true,
        highestLevelReached: true,
        levelRankScore: true,
        remotePreference: true,
        currentCity: true,
        currentState: true,
        openToRelocation: true,
        targetCompMin: true,
        compFlexible: true,
        targetRoleType: true,
        resumeKeywords: true,
        yearsExperience: true,
        industryContext: true,
        secondaryIndustryContext: true,
        targetIndustries: true,
        isPeopleManager: true,
        hasJD: true,
        hasMD: true,
        hasDO: true,
        targetCompanySize: true,
        priorityMaxComp: true,
        priorityBrandName: true,
        priorityWorkLife: true,
        priorityMission: true,
      },
    }),
    prisma.exclusiveJobPosting.findMany({ where: { status: 'pending', archivedAt: null } }),
  ])
  if (!candidate) return []
  return rankPendingPostingsForCandidate(candidate as AdminFitCandidate, pendingPostings).slice(0, 10)
}

export default async function AdminCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [authUsers, jobRecommendations] = await Promise.all([listAllAuthUsers(), loadJobRecommendations(id)])
  const detail = await getAdminCandidateDetail(id, authUsers).catch(() => null)
  if (!detail) notFound()

  const { view } = detail

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/candidates" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to candidates
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{view.candidateName}</h1>
        <p className="mt-1 text-muted-foreground">
          {detail.authEmail}
          {view.weekNumber !== null && ` · Week ${view.weekNumber} in search`}
          {view.statusLabel && ` · ${view.statusLabel}`}
        </p>
      </div>

      {detail.sentimentAlert.lowSentiment && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-foreground">Sentiment alert</p>
          <p className="mt-1 text-muted-foreground">
            Trailing-14-day mood check-ins show{' '}
            {detail.sentimentAlert.reason === 'declining_trend' ? 'a declining trend' : 'a low average'}.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Targeting</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {view.targetRoleType && (
              <div>
                <dt className="text-muted-foreground">Target role</dt>
                <dd className="text-foreground">{view.targetRoleType}</dd>
              </div>
            )}
            {view.primaryFunction && (
              <div>
                <dt className="text-muted-foreground">Function</dt>
                <dd className="text-foreground">{view.primaryFunction}</dd>
              </div>
            )}
            {view.targetIndustries.length > 0 && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Industries</dt>
                <dd className="text-foreground">{view.targetIndustries.join(', ')}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade history</CardTitle>
        </CardHeader>
        <CardContent>
          {view.gradeHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {view.gradeHistory.map((g, i) => (
                <li key={i} className="text-foreground">
                  {g.generatedAt.toLocaleDateString()} — {g.marketGrade ?? '—'}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coach</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.coach ? (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                {detail.coach.name} —{' '}
                {detail.coach.hasConsent ? (
                  <span className="text-success">Dossier consent granted</span>
                ) : (
                  <span className="text-muted-foreground">Consent not yet granted</span>
                )}
              </p>
              <Link
                href={`/support/admin/coaches/${detail.coach.id}`}
                className="text-primary underline underline-offset-4"
              >
                View coach
              </Link>
              {view.sessions.length > 0 && (
                <ul className="space-y-1 pt-2">
                  {view.sessions.map((s) => (
                    <li key={s.id} className="text-muted-foreground">
                      {s.occurredAt.toLocaleDateString()}
                      {s.durationMinutes && ` · ${s.durationMinutes} min`}
                      {s.directives && (s.directivesResolvedAt ? ' · directive followed through' : ' · directive open')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No coach assigned.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Jobs surfaced</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{detail.jobActivity.totalSurfaced}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Good fit or better</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{detail.jobActivity.goodFitOrBetter}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">In their geo</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{detail.jobActivity.inGeo}</dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tracked applications ({detail.jobActivity.tracked.length})
            </p>
            {detail.jobActivity.tracked.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None tracked yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {detail.jobActivity.tracked.map((j) => (
                  <li key={j.id} className="truncate text-foreground">
                    {j.url ?? '(email-detected, no URL)'}
                    {j.offerReceivedAt ? ' — offer received' : j.interviewLandedAt ? ' — interviewing' : j.appliedAt ? ' — applied' : ' — not yet applied'}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Surfaced matches ({detail.jobActivity.surfaced.length})
            </p>
            {detail.jobActivity.surfaced.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None surfaced yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {detail.jobActivity.surfaced.map((j) => (
                  <li key={j.id} className="text-foreground">
                    {j.title}
                    {j.companyName && ` at ${j.companyName}`}
                    {j.reaction && ` — ${j.reaction.toLowerCase()}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Jobs clicked ({detail.jobClicks.length})
            </p>
            {detail.jobClicks.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No job links clicked yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {detail.jobClicks.map((c) => (
                  <li key={c.id} className="text-foreground">
                    {c.createdAt.toLocaleDateString()} —{' '}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {c.jobTitle}
                    </a>
                    {c.companyName && ` at ${c.companyName}`}
                    <span className="text-muted-foreground"> ({c.source === 'job_board' ? 'Job Board' : 'Surfaced'})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Pending Job Board listings ranked by fit for this candidate specifically — highest first.
            Approving here makes the listing visible to every eligible candidate, not just this one.
          </p>
          {jobRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending right now.</p>
          ) : (
            <ul className="space-y-3">
              {jobRecommendations.map(({ posting, score }) => {
                const location = displayJobLocation(posting.location)
                return (
                  <li key={posting.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">
                        {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
                      </p>
                      {location && <p className="text-xs text-muted-foreground">{location}</p>}
                      <p className="text-xs font-medium text-foreground tabular-nums">{score}% fit</p>
                    </div>
                    <form action={approveJobPosting.bind(null, posting.id)}>
                      <SubmitButton size="sm" pendingLabel="Approving…">
                        Approve
                      </SubmitButton>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent>
          {view.references.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {view.references.map((r, i) => (
                <li key={i}>
                  {r.refereeName} — {r.status}
                  {r.wouldHireAgain !== null && (r.wouldHireAgain ? ', would hire again' : ', would not hire again')}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work samples</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.workSamples.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {detail.workSamples.map((w) => (
                <li key={w.id}>
                  {w.title} ({w.sampleType}){w.verified && ' — verified'}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work history</CardTitle>
        </CardHeader>
        <CardContent>
          {view.workHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {view.workHistory.map((w, i) => (
                <li key={i}>
                  {w.roleTitle} at {w.companyName} ({w.startDate.getFullYear()}–
                  {w.isCurrent ? 'Present' : w.endDate?.getFullYear()})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment over time</CardTitle>
        </CardHeader>
        <CardContent>
          <MotivationChart baseline={null} history={detail.moodHistory} />
        </CardContent>
      </Card>
    </div>
  )
}
