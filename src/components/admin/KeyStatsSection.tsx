import { VisitorsPerDayChart } from '@/components/admin/VisitorsPerDayChart'
import { nonJobsShare, type KeyStatsDay } from '@/lib/admin/key-stats'

export interface KeyStatsDayWithMembers extends KeyStatsDay {
  marketRealityMembers: number
  emailSignups: number
}

type Sum = (d: KeyStatsDayWithMembers) => number

function sum(days: KeyStatsDayWithMembers[], pick: Sum): number {
  return days.reduce((s, d) => s + pick(d), 0)
}

function pct(days: KeyStatsDayWithMembers[]): string {
  const share = nonJobsShare({ jobsViews: sum(days, (d) => d.jobsViews), nonJobsViews: sum(days, (d) => d.nonJobsViews) })
  return share === null ? '–' : `${Math.round(share * 100)}%`
}

export function KeyStatsSection({ days, countryTrackedSince }: { days: KeyStatsDayWithMembers[]; countryTrackedSince: string | null }) {
  const last7 = days.slice(-7)
  const prev7 = days.slice(-14, -7)
  const last30 = days.slice(-30)
  const windows = [
    { label: 'Last 7 days', days: last7 },
    { label: 'Previous 7 days', days: prev7 },
    { label: `Last ${last30.length} days`, days: last30 },
  ]
  const rows: { label: string; value: (d: KeyStatsDayWithMembers[]) => string }[] = [
    { label: 'People on the homepage', value: (d) => String(sum(d, (x) => x.homepageVisitors)) },
    { label: 'Members on Market Reality', value: (d) => String(sum(d, (x) => x.marketRealityMembers)) },
    { label: 'Email sign-ups', value: (d) => String(sum(d, (x) => x.emailSignups)) },
    { label: 'People on Reports', value: (d) => String(sum(d, (x) => x.reportsVisitors)) },
    { label: 'Non-jobs share of page views', value: pct },
    { label: 'Non-jobs page views', value: (d) => String(sum(d, (x) => x.nonJobsViews)) },
    { label: 'Jobs page views', value: (d) => String(sum(d, (x) => x.jobsViews)) },
    { label: 'US visitors', value: (d) => String(sum(d, (x) => x.usVisitors)) },
    { label: 'International visitors', value: (d) => String(sum(d, (x) => x.internationalVisitors)) },
    { label: 'Country not recorded (before tracking began)', value: (d) => String(sum(d, (x) => x.unknownCountryVisitors)) },
  ]
  const series = (pick: Sum) => days.map((d) => ({ dateKey: d.dateKey, count: pick(d) }))
  const sharePoints = days.map((d) => ({ dateKey: d.dateKey, count: Math.round((nonJobsShare(d) ?? 0) * 100) }))

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">Key stats over time</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Human traffic, last {days.length} days, Eastern time. Visitor counts add up one person (IP address) per day, so someone who returns on three days counts three times. Market Reality and
        sign-ups count signed-in members and captured emails; Market Reality is behind sign-in, so it cannot come from the public visit log.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 font-normal"></th>
            {windows.map((w) => (
              <th key={w.label} className="py-1 text-right font-normal">
                {w.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="py-1 pr-2">{r.label}</td>
              {windows.map((w) => (
                <td key={w.label} className="py-1 text-right tabular-nums">
                  {r.value(w.days)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="mb-1 text-sm font-medium text-foreground">Homepage, Market Reality, sign-ups and Reports, per day</h3>
          <VisitorsPerDayChart
            series={[
              { label: 'Homepage', days: series((d) => d.homepageVisitors), color: 'var(--color-brand)' },
              { label: 'Market Reality', days: series((d) => d.marketRealityMembers), color: 'var(--color-warning)' },
              { label: 'Email sign-ups', days: series((d) => d.emailSignups), color: 'var(--color-success)' },
              { label: 'Reports', days: series((d) => d.reportsVisitors), color: 'var(--color-destructive)' },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-foreground">Non-jobs pages as % of all page views, per day</h3>
          <VisitorsPerDayChart series={[{ label: 'Non-jobs %', days: sharePoints, color: 'var(--color-brand)' }]} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-foreground">Different pages viewed per day: jobs vs non-jobs</h3>
          <VisitorsPerDayChart
            series={[
              { label: 'Non-jobs pages', days: series((d) => d.nonJobsPages), color: 'var(--color-brand)' },
              { label: 'Jobs pages', days: series((d) => d.jobsPages), color: 'var(--color-warning)' },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-foreground">US vs international visitors, per day</h3>
          <p className="mb-1 text-xs text-muted-foreground">
            {countryTrackedSince ? `Country has been recorded since ${countryTrackedSince}; earlier days show no data here.` : 'Country is recorded from the first visit after this shipped, so this fills in over the coming days.'}
          </p>
          <VisitorsPerDayChart
            series={[
              { label: 'US', days: series((d) => d.usVisitors), color: 'var(--color-brand)' },
              { label: 'International', days: series((d) => d.internationalVisitors), color: 'var(--color-warning)' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
