import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { getApplicationFitOverview, type FitWindowDays } from '@/lib/admin/application-fit-data'
import { MIN_MEMBER_SAMPLE, SENIORITY_LABEL, shareOf } from '@/lib/admin/application-fit'
import { YEARS_FIT_RULE } from '@/lib/jobs/years-fit'
import { captureServerEvent } from '@/lib/posthog/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ApplicationFitFilters } from '@/components/admin/ApplicationFitFilters'
import { Histogram, VerdictShareBar } from '@/components/admin/ApplicationFitParts'

export const maxDuration = 30

const MATCHED_BY_LABEL: Record<string, string> = {
  board_card: 'Applied from a board card',
  url: 'Same URL on the board',
  company_title: 'Same company + title on the board',
  pasted_text: 'Posting text the member pasted',
  title_only: 'Title only (no posting found)',
  none: 'No title or posting',
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export default async function AdminApplicationFitPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const days: FitWindowDays = sp.days === '30' ? 30 : 90
  const sort = sp.sort === 'underselling' ? 'underselling' : 'reaching'

  let data: Awaited<ReturnType<typeof getApplicationFitOverview>> | null = null
  let loadError = false
  try {
    data = await getApplicationFitOverview(days, sort)
  } catch (err) {
    console.error('[admin/apply-fit] load failed', err)
    loadError = true
  }
  captureServerEvent(admin.email ?? 'admin', 'admin_application_fit_viewed', { scope: 'aggregate', days, sort, applications: data?.aggregate.overall.total ?? null })

  const agg = data?.aggregate
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/jobs" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to jobs
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Application fit</h1>
        <p className="mt-1 text-muted-foreground">
          Are members applying at the right seniority and years of experience? Admin only — never shown to members, recruiters or employers.
        </p>
      </div>

      <ApplicationFitFilters days={String(days)} sort={sort} />

      {loadError || !data || !agg ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Couldn&apos;t load application fit right now. Reload the page in a minute; if it keeps failing, check the server logs for “admin/apply-fit”.
          </CardContent>
        </Card>
      ) : agg.overall.total === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No applications in the last {days} days. Applications come from the board’s “I applied”, Gmail detection and the Application Tracker.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>All applications, last {days} days ({agg.overall.total})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VerdictShareBar counts={agg.overall} />
              <p className="text-sm text-muted-foreground">
                Shares are of the {agg.overall.total - agg.overall.unknown} applications we could compare.{' '}
                {data.yearsParsed} of {agg.overall.total} jobs state a years requirement we could read
                {agg.overall.total > 0 && ` (${pct(data.yearsParsed / agg.overall.total)})`}.
                {data.truncated && ' Capped at the most recent 10,000 applications.'}
              </p>
              {data.clicksWithoutApplication.total > 0 && (
                <p className="text-sm text-muted-foreground">
                  Separately, {data.clicksWithoutApplication.total} apply clicks have no application recorded: {data.clicksWithoutApplication.reaching} reaching,{' '}
                  {data.clicksWithoutApplication.on_target} on target, {data.clicksWithoutApplication.underselling} underselling,{' '}
                  {data.clicksWithoutApplication.unknown} unknown.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Members with {MIN_MEMBER_SAMPLE}+ comparable applications</CardTitle>
            </CardHeader>
            <CardContent>
              {agg.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No member has {MIN_MEMBER_SAMPLE} or more comparable applications in this window yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-4 font-normal">Member</th>
                        <th className="py-2 pr-4 text-right font-normal">Applications</th>
                        <th className="py-2 pr-4 text-right font-normal">Reaching</th>
                        <th className="py-2 pr-4 text-right font-normal">On target</th>
                        <th className="py-2 text-right font-normal">Underselling</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.members.map((m) => (
                        <tr key={m.candidateId} className="border-t border-border/50">
                          <td className="py-2 pr-4">
                            <Link href={`/support/admin/candidates/${m.candidateId}`} className="text-primary underline underline-offset-4">
                              {data.memberNames[m.candidateId]}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">{m.counts.total}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{pct(m.reachingShare)} ({m.counts.reaching})</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{pct(shareOf(m.counts, 'on_target'))} ({m.counts.on_target})</td>
                          <td className="py-2 text-right tabular-nums">{pct(m.undersellingShare)} ({m.counts.underselling})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Seniority step</CardTitle>
              </CardHeader>
              <CardContent>
                <Histogram label="Applications by seniority step" rows={agg.seniority.map((s) => ({ label: SENIORITY_LABEL[s.step], count: s.count }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Years fit ({agg.yearsKnown} with stated years)</CardTitle>
              </CardHeader>
              <CardContent>
                {agg.yearsKnown === 0 ? (
                  <p className="text-sm text-muted-foreground">None of these jobs state a years requirement we could read.</p>
                ) : (
                  <Histogram label="Applications by years fit" rows={agg.yearsGap.map((g) => ({ label: g.bin, count: g.count }))} />
                )}
              </CardContent>
            </Card>
          </div>

          {[
            { title: 'By member level', rows: agg.byLevel },
            { title: 'By member function', rows: agg.byFunction },
          ].map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.rows.map((r) => (
                  <div key={r.key}>
                    <p className="mb-1 text-sm font-medium text-foreground">
                      {r.key} <span className="font-normal text-muted-foreground">({r.counts.total})</span>
                    </p>
                    <VerdictShareBar counts={r.counts} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>How it’s read</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground">Seniority</span> — the job’s rung (from the board, else its title) against the member’s level, on the same scale as board fit scoring.
                Up 2+ levels is reaching; up 1 is a healthy stretch; down 2+ is underselling. A pivoting member’s step down doesn’t count.
              </p>
              <p>
                <span className="text-foreground">Years</span> — lenient, the same rule board fit scoring uses. Short of the stated minimum by up to{' '}
                {YEARS_FIT_RULE.minTolerance} years (or {Math.round(YEARS_FIT_RULE.toleranceShare * 100)}% of the minimum, if more) is in line, so 6 against
                “8–15” is fine. Shorter but at least half the minimum is a stretch, still on target. Under half the minimum (2 against “8–15”) is far short, and only
                that counts as reaching. Overqualified needs at least {YEARS_FIT_RULE.overMinYears} years over the minimum and more than twice the top of the range
                (twice the minimum when there’s no top), so 15 against “10+” is not. “Preferred” and “or equivalent” requirements get one more year of slack.
                Overqualified only counts as underselling when the level is also below theirs or unknown.
              </p>
              <p>How each job was found:</p>
              <ul className="space-y-1">
                {Object.entries(data.matchedBy).filter(([, n]) => n > 0).map(([k, n]) => (
                  <li key={k} className="flex justify-between">
                    <span>{MATCHED_BY_LABEL[k] ?? k}</span>
                    <span className="tabular-nums text-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
