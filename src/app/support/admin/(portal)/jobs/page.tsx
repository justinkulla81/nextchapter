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

      <Card>
        <CardHeader>
          <CardTitle>Job clicks — by company (top 25)</CardTitle>
        </CardHeader>
        <CardContent>
          {rollup.clicks.byCompany.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {rollup.clicks.byCompany.map((c) => (
                <li key={c.companyName} className="flex justify-between">
                  <span className="text-foreground">{c.companyName}</span>
                  <span className="tabular-nums text-muted-foreground">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job clicks — by title (top 25)</CardTitle>
        </CardHeader>
        <CardContent>
          {rollup.clicks.byTitle.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {rollup.clicks.byTitle.map((t) => (
                <li key={t.jobTitle} className="flex justify-between">
                  <span className="text-foreground">{t.jobTitle}</span>
                  <span className="tabular-nums text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent job clicks (last 50)</CardTitle>
        </CardHeader>
        <CardContent>
          {rollup.clicks.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase">
                    <th className="py-1.5 pr-3">Date</th>
                    <th className="py-1.5 pr-3">Candidate</th>
                    <th className="py-1.5 pr-3">Job</th>
                    <th className="py-1.5 pr-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.clicks.recent.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                        {c.createdAt.toLocaleDateString()}
                      </td>
                      <td className="py-1.5 pr-3 text-foreground">{c.candidateName}</td>
                      <td className="py-1.5 pr-3">
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {c.jobTitle}
                        </a>
                        {c.companyName && <span className="text-muted-foreground"> at {c.companyName}</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
