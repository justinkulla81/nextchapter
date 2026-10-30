import { requireAdmin } from '@/lib/admin/auth'
import { loadJobStatuses } from '@/lib/cron/watchdog'
import { UNHEALTHY, type JobHealth } from '@/lib/cron/health'
import { RERUN_SAFE_JOBS } from '@/lib/cron/schedule'
import { SubmitButton } from '@/components/ui/submit-button'
import { runJobNow } from './actions'
import { pct, readJobSearchHealth } from '@/lib/syndication/job-search-health'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const LABEL: Record<JobHealth, string> = {
  healthy: 'Healthy',
  failed: 'Failed',
  timed_out: 'Cut off',
  overdue: 'Overdue',
  waiting: 'Waiting for first run',
}
const DOT: Record<JobHealth, string> = {
  healthy: 'bg-success',
  failed: 'bg-destructive',
  timed_out: 'bg-destructive',
  overdue: 'bg-warning',
  waiting: 'bg-muted-foreground',
}

function ago(d: Date | null): string {
  if (!d) return '—'
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
  if (mins < 60) return `${mins} min ago`
  if (mins < 2880) return `${Math.round(mins / 60)} hr ago`
  return `${Math.round(mins / 1440)} days ago`
}

export default async function JobHealthPage() {
  await requireAdmin()

  let statuses: Awaited<ReturnType<typeof loadJobStatuses>> | null = null
  try {
    statuses = await loadJobStatuses()
  } catch (e) {
    console.error('Job health page failed to load', e)
  }

  if (!statuses) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Background job health</h1>
        <p className="text-sm">
          Job history could not be loaded. If this is new, the CronRun and CronJobAlert tables may not exist yet:
          run <code>npx prisma db push --skip-generate</code> and reload.
        </p>
      </div>
    )
  }

  const searchHealth = await readJobSearchHealth().catch(() => [])
  const today = searchHealth[searchHealth.length - 1]
  const needAttention = statuses.filter((s) => UNHEALTHY.has(s.health))
  const rank = (h: JobHealth) => (UNHEALTHY.has(h) ? 0 : h === 'waiting' ? 1 : 2)
  const sorted = [...statuses].sort((a, b) => rank(a.health) - rank(b.health) || a.job.localeCompare(b.job))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Background job health</h1>
        <p className="text-sm" role="status">
          {needAttention.length === 0
            ? `All ${statuses.length} scheduled jobs are completing on time.`
            : `${needAttention.length} of ${statuses.length} scheduled jobs need attention. You are emailed about each one once a day until it recovers.`}
        </p>
      </div>

      <section className="space-y-2" aria-labelledby="google-jobs-heading">
        <h2 id="google-jobs-heading" className="text-lg font-semibold">Jobs in front of Google for Jobs</h2>
        {!today ? (
          <p className="text-sm">No reading yet. The numbers are taken once a day by the <code>indexnow-jobs</code> job.</p>
        ) : (
          <>
            <p className="text-sm">As of {today.day}.</p>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>{pct(today.schemaValid, today.schemaSampled)}%</strong> of sampled job pages carry complete JobPosting data ({today.schemaValid} of {today.schemaSampled} checked)
                {Object.keys(today.schemaMissing).length > 0 && `. Missing: ${Object.entries(today.schemaMissing).map(([k, n]) => `${k} ${n}`).join(', ')}`}
              </li>
              <li>
                <strong>{pct(today.inSitemap, today.liveJobs)}%</strong> of live jobs are in a job sitemap ({today.inSitemap.toLocaleString()} of {today.liveJobs.toLocaleString()}); {pct(today.inSitemap, today.publicPages)}% of the {today.publicPages.toLocaleString()} jobs with a public page
              </li>
              <li>
                Not in a sitemap: {(today.liveJobs - today.verifiedInWindow).toLocaleString()} not confirmed open in the last 14 days (their page is gone), {today.thinNoindex.toLocaleString()} with only a snippet of the posting, the rest filtered out (hourly, internships, closed and reposted, private)
              </li>
              <li>{today.offeredToGoogleApi.toLocaleString()} are eligible for the Google Indexing API push (200 a day); {today.payStated.toLocaleString()} public pages state pay</li>
              <li>
                Search Console, job sitemaps:{' '}
                {'unavailable' in today.searchConsole
                  ? `not readable (${today.searchConsole.unavailable})`
                  : `${today.searchConsole.files} files read, ${today.searchConsole.submitted.toLocaleString()} URLs submitted, ${today.searchConsole.errors} errors, ${today.searchConsole.warnings} warnings`}
              </li>
            </ul>
            {searchHealth.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Last {Math.min(searchHealth.length, 7)} days, in a sitemap: {searchHealth.slice(-7).map((h) => `${h.day.slice(5)} ${pct(h.inSitemap, h.liveJobs)}%`).join(' · ')}
              </p>
            )}
          </>
        )}
      </section>

      {sorted.length === 0 ? (
        <p className="text-sm">No scheduled jobs are configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Scheduled jobs and the outcome of their latest run</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4">Job</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Last started</th>
                <th scope="col" className="py-2 pr-4">Took</th>
                <th scope="col" className="py-2 pr-4">Detail</th>
                <th scope="col" className="py-2 pr-4">Run again</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.job} className="align-top">
                  <th scope="row" className="py-2 pr-4 font-medium">{s.job}</th>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${DOT[s.health]}`} aria-hidden="true" />
                    {LABEL[s.health]}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{ago(s.lastStartedAt)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {s.lastDurationMs == null ? '—' : `${(s.lastDurationMs / 1000).toFixed(1)} s`}
                  </td>
                  <td className="py-2 pr-4">
                    {UNHEALTHY.has(s.health) ? s.detail : ''}
                    {s.lastTrigger === 'retry' ? ' This was the automatic retry.' : ''}
                  </td>
                  <td className="py-2 pr-4">
                    {RERUN_SAFE_JOBS.has(s.job) ? (
                      <form action={runJobNow}>
                        <input type="hidden" name="job" value={s.job} />
                        <SubmitButton size="sm" variant="outline" pendingLabel="Running…" savedLabel="Finished" aria-label={`Run ${s.job} now`}>
                          Run now
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-muted-foreground">Emails people, so it only runs on schedule</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm">
        A failed or cut-off data-sync job is retried once automatically. Jobs that email people are never retried or run by hand, so nothing is sent twice. The checker itself is the <code>job-health</code> job, which runs every 15 minutes. If it shows as overdue, nothing is watching the others.
      </p>
    </div>
  )
}
