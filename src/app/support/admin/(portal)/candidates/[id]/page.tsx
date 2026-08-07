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
import { CandidateNudgeEmailPanel } from '@/components/admin/CandidateNudgeEmailPanel'
import { PRIVACY_TIERS } from '@/lib/constants/privacy'
import { NOTIFICATION_TIERS } from '@/lib/constants/notifications'

const NUDGE_TYPE_LABEL: Record<string, string> = {
  WEEKLY_TARGET: 'Weekly target',
  NETWORKING: 'Networking',
  LEARNING: 'Learning',
  INTERIM_JOB: 'Interim job',
  CONNECT_GMAIL: 'Connect Gmail',
  UPDATE_PROFILE: 'Update profile',
  COMMUNITY: 'Community',
  RECRUITER_HELP: 'Recruiter/coach help',
  UPDATE_PRIVACY: 'Update privacy',
}

async function loadPrivacyAndEmailTrail(candidateId: string) {
  const [profile, emailLogs] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        privacyTier: true,
        notificationTier: true,
        recruiterDatabaseOptIn: true,
        resumeBookOptIn: true,
        dailyEmailOptedOut: true,
        weeklyReportOptedOut: true,
        sprintGoalEmailsOptedOut: true,
        marketDigestOptedOut: true,
        reminderEmailsOptedOut: true,
        weeklySprintTargetOptOut: true,
        encouragementGivingOptIn: true,
        smsConsentedAt: true,
      },
    }),
    prisma.adminEmailLog.findMany({
      where: { candidateId },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
  ])
  return { profile, emailLogs }
}

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

  const [authUsers, jobRecommendations, { profile: privacyProfile, emailLogs }] = await Promise.all([
    listAllAuthUsers(),
    loadJobRecommendations(id),
    loadPrivacyAndEmailTrail(id),
  ])
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

      {privacyProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy &amp; notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Privacy tier</dt>
                <dd className="text-foreground">
                  {PRIVACY_TIERS.find((t) => t.value === privacyProfile.privacyTier)?.label ??
                    privacyProfile.privacyTier}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Notifications</dt>
                <dd className="text-foreground">
                  {NOTIFICATION_TIERS.find((t) => t.value === privacyProfile.notificationTier)?.label ??
                    privacyProfile.notificationTier}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recruiter Database</dt>
                <dd className="text-foreground">{privacyProfile.recruiterDatabaseOptIn ? 'Opted in' : 'Not opted in'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Resume Book</dt>
                <dd className="text-foreground">{privacyProfile.resumeBookOptIn ? 'Opted in' : 'Not opted in'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Encouragement notes</dt>
                <dd className="text-foreground">
                  {privacyProfile.encouragementGivingOptIn ? 'Opted in' : 'Not opted in'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">SMS</dt>
                <dd className="text-foreground">
                  {privacyProfile.smsConsentedAt ? 'Consented' : 'Not consented'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Opted out of</dt>
                <dd className="text-foreground">
                  {[
                    privacyProfile.dailyEmailOptedOut && 'daily emails',
                    privacyProfile.weeklyReportOptedOut && 'weekly report',
                    privacyProfile.sprintGoalEmailsOptedOut && 'sprint goal emails',
                    privacyProfile.marketDigestOptedOut && 'market digest',
                    privacyProfile.reminderEmailsOptedOut && 'reminder emails',
                    privacyProfile.weeklySprintTargetOptOut && 'weekly sprint target nudges',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Nothing — full email cadence'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Send a nudge email</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateNudgeEmailPanel candidateId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email trail</CardTitle>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin emails sent to this candidate yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {emailLogs.map((log) => (
                <li key={log.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {NUDGE_TYPE_LABEL[log.nudgeType] ?? log.nudgeType} — {log.subject}
                    </p>
                    <span
                      className={log.status === 'sent' ? 'text-xs text-success' : 'text-xs text-destructive'}
                    >
                      {log.status === 'sent' ? 'Sent' : 'Failed'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.sentAt.toLocaleString()} · by {log.sentByEmail} · to {log.recipientEmail}
                  </p>
                  {log.errorMessage && <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
