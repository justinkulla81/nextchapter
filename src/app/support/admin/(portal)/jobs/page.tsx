import { requireAdmin } from '@/lib/admin/auth'
import { getJobsRollup } from '@/lib/admin/jobs-rollup'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const maxDuration = 30

const REASON_LABEL: Record<string, string> = {
  WRONG_FUNCTION: 'Wrong function',
  WRONG_INDUSTRY: 'Wrong industry',
  COMP_TOO_LOW: 'Comp too low',
  SENIORITY_MISMATCH: 'Seniority mismatch',
  LOCATION_MISMATCH: 'Location mismatch',
  MISSING_EXPERIENCE: 'Missing experience',
  COMPANY_UNATTRACTIVE: 'Company unattractive',
  DONT_FEEL_QUALIFIED: "Don't feel qualified",
  WOULD_PURSUE_WITH_CONNECTION: 'Would pursue with a connection',
}

export default async function AdminJobsPage() {
  await requireAdmin()
  const rollup = await getJobsRollup()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="mt-1 text-muted-foreground">Aggregate activity across tracked jobs, surfaced jobs, and the Job Board.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked jobs ({rollup.tracked.total})</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Applied</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.tracked.applied}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Interviewing</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.tracked.interviewing}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Offered</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.tracked.offered}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surfaced jobs ({rollup.surfaced.total})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">No reaction yet</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.surfaced.unreacted}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Interested</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.surfaced.interested}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Not interested</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.surfaced.notInterested}</dd>
            </div>
          </dl>
          {rollup.surfaced.reasonBreakdown.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Not-interested reasons</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {rollup.surfaced.reasonBreakdown.map((r) => (
                  <li key={r.reason} className="flex justify-between">
                    <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                    <span className="tabular-nums text-foreground">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Board ({rollup.board.total} active)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Pending review</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.board.pending}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approved</dt>
              <dd className="text-lg font-medium tabular-nums text-foreground">{rollup.board.approved}</dd>
            </div>
          </dl>
          {rollup.board.bySource.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">By source</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {rollup.board.bySource.map((s) => (
                  <li key={s.source} className="flex justify-between">
                    <span>{s.source}</span>
                    <span className="tabular-nums text-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
