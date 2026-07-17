import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getRecruiterReportData } from '@/lib/reports/recruiter-report'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { Logo } from '@/components/Logo'

export default async function RecruiterReportPage() {
  const profile = await getDashboardData()
  const data = await getRecruiterReportData(profile.id)

  const hasEffort = data.effortSummaryLines.length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recruiter Report</h1>
          <p className="mt-1 text-muted-foreground">
            Your executive dossier — every reference, work sample, and network signal you&apos;ve
            built here, plus your execution score, in one document. Hand it to any hiring manager,
            recruiter, or coach alongside your resume and cover letter. You control when this is
            generated and shared; it&apos;s never sent automatically.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <PrintReportButton />
        </div>
      </div>

      <div className="space-y-8 rounded-xl border border-border p-8 print:border-0 print:p-0">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Logo className="text-xl" />
          <p className="text-sm text-muted-foreground">
            Generated {data.generatedAt.toLocaleDateString()}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.candidateName}</h2>
          {data.availability.targetRoleType && (
            <p className="text-muted-foreground">Targeting: {data.availability.targetRoleType}</p>
          )}
        </div>

        <section>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Effort summary
          </h3>
          {hasEffort ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {data.effortSummaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              This candidate is just getting started — check back soon for more detail.
            </p>
          )}
        </section>

        {data.peerSupportLine && (
          <section>
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Peer Support
            </h3>
            <p className="mt-2 text-sm text-foreground">{data.peerSupportLine}</p>
          </section>
        )}

        {data.references.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              References
            </h3>
            <div className="mt-2 space-y-3">
              {data.references.map((r, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-foreground">{r.refereeName}</p>
                  {r.strengthSummary && (
                    <p className="text-sm text-muted-foreground">{r.strengthSummary}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.learningItems.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Learning
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {data.learningItems.map((item, i) => (
                <li key={i}>
                  {item.title}
                  {item.provider ? ` — ${item.provider}` : ''}{' '}
                  <span className="text-muted-foreground">
                    ({item.completedAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Availability &amp; fit
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            {data.availability.statusLabel && (
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium text-foreground">{data.availability.statusLabel}</dd>
              </div>
            )}
            {data.availability.primaryFunction && (
              <div>
                <dt className="text-muted-foreground">Function</dt>
                <dd className="font-medium text-foreground">{data.availability.primaryFunction}</dd>
              </div>
            )}
            {data.availability.highestLevelReached && (
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium text-foreground">{data.availability.highestLevelReached}</dd>
              </div>
            )}
            {data.availability.targetIndustries.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Target industries</dt>
                <dd className="font-medium text-foreground">
                  {data.availability.targetIndustries.join(', ')}
                </dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground">{data.availability.locationPreference}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        Want to see your work history reflected here?{' '}
        <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
          Add or edit it on your Resume page
        </Link>
        .
      </p>
    </div>
  )
}
