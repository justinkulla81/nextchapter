import { getSharedProfileView } from '@/lib/sharing/profile-share'
import { GRADE_LABEL } from '@/lib/scoring/grade'

const RECIPIENT_LABEL: Record<string, string> = {
  HIRING_MANAGER: 'hiring manager',
  RECRUITER: 'recruiter',
  COACH: 'coach',
}

function StatusMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  )
}

function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  return `${fmt(startDate)} – ${isCurrent || !endDate ? 'present' : fmt(endDate)}`
}

export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const view = await getSharedProfileView(token)

  if (view.status === 'not_found') {
    return (
      <StatusMessage title="This link isn't valid">
        Double check the link you were sent.
      </StatusMessage>
    )
  }

  if (view.status === 'revoked') {
    return (
      <StatusMessage title="This link has been turned off">
        {view.candidateName} has revoked access to this profile view.
      </StatusMessage>
    )
  }

  if (view.status === 'expired') {
    return (
      <StatusMessage title="This link has expired">
        Ask {view.candidateName} to send you a new one.
      </StatusMessage>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">{view.candidateName}</h1>
        {view.targetRoleType && <p className="text-muted-foreground">Targeting: {view.targetRoleType}</p>}
      </div>

      <div className="mb-8 rounded-lg border border-border bg-off-white p-4 text-sm text-muted-foreground">
        {view.candidateName} controls exactly what&apos;s shared here, and with whom — this view was
        built specifically for you as a {RECIPIENT_LABEL[view.recipientType ?? '']}. Nothing here is
        publicly listed or searchable.
      </div>

      <div className="space-y-8">
        {view.coreStatement && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              About
            </h2>
            <p className="mt-2 text-foreground">{view.coreStatement}</p>
          </section>
        )}

        {view.knownFor && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Known for
            </h2>
            <p className="mt-2 text-foreground">{view.knownFor}</p>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Background
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            {view.primaryFunction && (
              <div>
                <dt className="text-muted-foreground">Function</dt>
                <dd className="font-medium">{view.primaryFunction}</dd>
              </div>
            )}
            {view.highestLevelReached && (
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium">{view.highestLevelReached}</dd>
              </div>
            )}
            {view.yearsExperience !== null && (
              <div>
                <dt className="text-muted-foreground">Years of experience</dt>
                <dd className="font-medium">{view.yearsExperience}</dd>
              </div>
            )}
            {view.targetIndustries.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Target industries</dt>
                <dd className="font-medium">{view.targetIndustries.join(', ')}</dd>
              </div>
            )}
            {view.targetCompMin !== null && (
              <div>
                <dt className="text-muted-foreground">Comp expectation</dt>
                <dd className="font-medium">${view.targetCompMin.toLocaleString()}+</dd>
              </div>
            )}
          </dl>
        </section>

        {view.workHistory.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Work history
            </h2>
            <div className="mt-2 space-y-3">
              {view.workHistory.map((w, i) => (
                <div key={i}>
                  <p className="font-medium text-foreground">
                    {w.roleTitle} · {w.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(w.startDate, w.endDate, w.isCurrent)}
                  </p>
                  {w.keyAchievement && (
                    <p className="mt-1 text-sm text-muted-foreground">{w.keyAchievement}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {view.gapExplanation && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              On the gap in my history
            </h2>
            <p className="mt-2 text-foreground">{view.gapExplanation}</p>
          </section>
        )}

        {view.resumeSignedUrl && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Resume
            </h2>
            <a
              href={view.resumeSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
            >
              View resume →
            </a>
          </section>
        )}

        {view.references.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              References
            </h2>
            <div className="mt-2 space-y-3">
              {view.references.map((r, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{r.refereeName}</p>
                  {r.strengthSummary && (
                    <p className="mt-1 text-sm text-muted-foreground">{r.strengthSummary}</p>
                  )}
                  {r.wouldHireAgain !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.wouldHireAgain ? 'Would hire again' : 'Would not hire again'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {view.marketRealityGrade && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Grades
            </h2>
            <div className="mt-2 flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Current Market Reality</p>
                <p className="text-lg font-semibold">
                  {view.marketRealityGrade.grade}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({GRADE_LABEL[view.marketRealityGrade.grade]})
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              This candidate&apos;s private coaching conversations are never included in this
              share.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
