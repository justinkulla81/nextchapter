import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { countVerdicts, SENIORITY_LABEL } from '@/lib/admin/application-fit'
import type { MemberApplicationFit } from '@/lib/admin/application-fit-data'
import { formatYearsRequirement } from '@/lib/jobs/years-required'
import { seniorityLabel } from '@/lib/jobs/job-seniority'
import { VerdictBadge, VerdictShareBar } from '@/components/admin/ApplicationFitParts'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

// Admin candidate page: is this member applying at the right level / years?
// Admin-only — the coaching line is for admins/coaches, never the member.
export function ApplicationFitCard({ data }: { data: MemberApplicationFit | null }) {
  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle>Application fit</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Couldn&apos;t load application fit. Reload the page to try again.</CardContent>
      </Card>
    )
  }
  const { member, rows, unconfirmedClicks, suggestion } = data
  const counts = countVerdicts(rows.map((r) => r.result.verdict))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application fit ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Their level: <span className="text-foreground">{member?.highestLevelReached ?? 'not set'}</span> · Years:{' '}
          <span className="text-foreground">{member?.yearsExperience ?? 'unknown'}</span>
          {member?.isPivoting && <> · <span className="text-foreground">Pivoting</span></>}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications recorded yet (board “I applied”, Gmail detection or the Application Tracker).</p>
        ) : (
          <>
            <p className="rounded-md bg-muted px-4 py-2 text-sm text-foreground">
              <span className="font-medium">Coaching note: </span>
              {suggestion}
            </p>
            <VerdictShareBar counts={counts} />
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-normal">Job</th>
                    <th className="py-2 pr-4 font-normal">Applied</th>
                    <th className="py-2 pr-4 font-normal">Years asked</th>
                    <th className="py-2 pr-4 font-normal">Job level</th>
                    <th className="py-2 pr-4 font-normal">Verdict</th>
                    <th className="py-2 font-normal">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/50 align-top">
                      <td className="py-2 pr-4">
                        <span className="text-foreground">{r.title ?? 'Untitled'}</span>
                        {r.companyName && <span className="block text-muted-foreground">{r.companyName}</span>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 tabular-nums">{dateFmt.format(r.date)}</td>
                      <td className="py-2 pr-4">{formatYearsRequirement(r.yearsRequired)}</td>
                      <td className="py-2 pr-4">
                        {seniorityLabel(r.jobLevel) ?? r.jobLevel ?? '—'}
                        <span className="block text-muted-foreground">{SENIORITY_LABEL[r.result.seniority]}{r.result.pivotExplained ? ' (pivoting)' : ''}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <VerdictBadge verdict={r.result.verdict} />
                        <span className="block text-muted-foreground">{r.result.reason}</span>
                      </td>
                      <td className="py-2">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {unconfirmedClicks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground">Apply clicks with no application recorded (last 90 days)</p>
            <ul className="mt-1 space-y-1 text-sm">
              {unconfirmedClicks.slice(0, 20).map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {c.title}
                    {c.companyName && <span className="text-muted-foreground"> · {c.companyName}</span>}
                  </span>
                  <span className="text-muted-foreground"><VerdictBadge verdict={c.result.verdict} /> · {c.result.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
