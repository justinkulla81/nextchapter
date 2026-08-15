import Link from 'next/link'
import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { getVisibleSubmissionsForHiringManager } from '@/lib/hiring/visibility'
import { getDuePostHireFeedbacks } from '@/lib/hiring/post-hire-feedback'
import { STAGE_LABEL } from '@/lib/recruiter/submission-stages'

export default async function HiringOverviewPage() {
  const hiringManager = await getCurrentHiringManager()
  const [submissions, dueFeedbacks] = await Promise.all([
    getVisibleSubmissionsForHiringManager(hiringManager.id),
    getDuePostHireFeedbacks(hiringManager.id),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidates submitted to your reqs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only candidates submitted to one of your reqs appear here — never a browsable pool.
        </p>
      </div>

      {dueFeedbacks.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="text-sm font-medium text-foreground">90-day feedback due</p>
          <ul className="space-y-1">
            {dueFeedbacks.map((f) => (
              <li key={f.id} className="text-sm">
                <Link href={`/hiring/candidates/${f.submissionId}`} className="underline underline-offset-4">
                  {f.candidateName}
                </Link>{' '}
                — {f.roleTitle} at {f.companyName}
                {f.isOverdue && <span className="ml-2 text-xs text-destructive">Overdue</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No candidates submitted to your reqs yet. Once a recruiter submits someone for a matching role at{' '}
          {hiringManager.companyName}, they&apos;ll appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Req</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {submissions.map((s) => (
                <tr key={s.submissionId}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.candidateName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.reqTitle}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {STAGE_LABEL[s.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/hiring/candidates/${s.submissionId}`}
                      className="text-sm font-medium text-brand underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
