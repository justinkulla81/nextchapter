import Link from 'next/link'
import { PERSON_GROUP_LABEL } from '@/lib/outreach/person-groups'
import {
  CALL_OUTCOMES, WEEKDAYS, byGroup, byHour, bySource, byWeek, byWeekday, lastWeeks, quotaLabel, quotaProgress, rate, within,
  type QuotaRule, type Tally, type Touch,
} from '@/lib/outreach/touch-stats'
import { BucketChart, MIN_FOR_RATE, Spark, WeeklyChart } from '@/components/admin/OutreachCharts'
import { LogTouchForm } from '@/components/admin/LogTouchForm'
import { QuotaEditor } from '@/components/admin/QuotaEditor'
import { Chip, Tile, pct } from '@/components/admin/OutreachParts'

export const RANGES = [{ key: '30', label: '30 days', days: 30 }, { key: '90', label: '90 days', days: 90 }, { key: '365', label: 'Year', days: 365 }] as const
export type RangeKey = (typeof RANGES)[number]['key']

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`))

const delta = (cur: number, prev: number, label: string) => `${cur >= prev ? '+' : '−'}${Math.abs(cur - prev).toLocaleString()} vs ${label}`
const fmtRate = (t: Tally) => (t.sent ? `${Math.round(rate(t) * 100)}%` : '–')

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div><h2 className="text-sm font-medium text-muted-foreground">{title}</h2>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
    </section>
  )
}

/** All outreach, automated and by hand, by kind and by who it went to, over time and against weekly targets. */
export function OutreachTracker({ touches, quotas, range, capped }: { touches: Touch[]; quotas: QuotaRule[] | null; range: RangeKey; capped: boolean }) {
  const now = new Date()
  const days = RANGES.find((r) => r.key === range)!.days
  const from = new Date(now.getTime() - days * 86_400_000)
  const prevFrom = new Date(from.getTime() - days * 86_400_000)
  const cur = within(touches, from, now)
  const prev = within(touches, prevFrom, from)
  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase()
  const prevLabel = `the ${rangeLabel} before`

  const responded = cur.filter((t) => t.responded).length
  const prevResponded = prev.filter((t) => t.responded).length
  const calls = cur.filter((t) => t.channel === 'call')
  const connected = calls.filter((t) => t.responded).length

  const weeks = lastWeeks(now, Math.min(53, Math.max(4, Math.ceil(days / 7))))
  const weekly = byWeek(touches, weeks)
  const groups = byGroup(cur).sort((a, b) => b.all.sent - a.all.sent)
  const sources = bySource(cur)
  const rules = quotas ?? []
  const progress = quotaProgress(touches, rules, lastWeeks(now, 9))
  const overall = rules.find((r) => r.groupKey === 'ALL' && r.channel === 'ALL')?.weeklyTarget ?? null
  const hours = byHour(cur)
  const weekdays = byWeekday(cur)
  const noTime = cur.filter((t) => !t.hasTime).length

  const rangeHref = (k: RangeKey) => `/support/admin/crm/outreach${k === '90' ? '' : `?range=${k}`}`

  return (
    <div className="otr-viz space-y-8">
      <LogTouchForm outcomes={CALL_OUTCOMES} />

      <Section title="This week against your targets" hint="Monday to Sunday, Eastern time. Counts every email, call, LinkedIn message and text, automated or by hand.">
        {quotas === null ? (
          <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">Targets are not available right now. Everything else on this page still works.</p>
        ) : progress.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">No targets yet. Add one below, for example 25 touches a week to everyone, or 10 calls a week to recruiters.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-white">
            {progress.map((p) => {
              const done = p.thisWeek >= p.rule.weeklyTarget
              return (
                <li key={`${p.rule.groupKey}:${p.rule.channel}`} className="grid items-center gap-x-6 gap-y-2 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_auto]">
                  <div>
                    <p className="text-sm font-medium">{quotaLabel(p.rule)}</p>
                    <p className="text-xs text-muted-foreground">Hit in {p.weeksHit} of the last {p.weeksShown} full weeks</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm"><span className="tabular-nums">{p.thisWeek} of {p.rule.weeklyTarget} this week</span>{done && <Chip tone="bg-success/10 text-success">Target met</Chip>}</div>
                    <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={p.thisWeek} aria-valuemin={0} aria-valuemax={p.rule.weeklyTarget} aria-label={`${quotaLabel(p.rule)} this week`}><div className="h-full rounded-full bg-navy/70" style={{ width: `${Math.min(100, (100 * p.thisWeek) / p.rule.weeklyTarget)}%` }} /></div>
                  </div>
                  <Spark history={p.history} target={p.rule.weeklyTarget} />
                </li>
              )
            })}
          </ul>
        )}
        <details className="rounded-xl border border-border bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">Set or change targets</summary>
          <div className="mt-3"><QuotaEditor rules={rules} /></div>
        </details>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Over time</h2>
        <nav aria-label="Time range" className="flex gap-2">
          {RANGES.map((r) => <Link key={r.key} href={rangeHref(r.key)} aria-current={r.key === range ? 'page' : undefined} className={`rounded-md border px-3 py-1 text-sm font-medium ${r.key === range ? 'border-navy bg-navy text-white' : 'border-border bg-white hover:border-navy/40'}`}>{r.label}</Link>)}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Touches" value={cur.length.toLocaleString()} sub={delta(cur.length, prev.length, prevLabel)} />
        <Tile label="Responded" value={responded.toLocaleString()} sub={`${pct(responded, cur.length)} · ${delta(responded, prevResponded, prevLabel)}`} />
        <Tile label="Calls made" value={calls.length.toLocaleString()} sub={calls.length ? `${connected} connected (${pct(connected, calls.length)})` : 'None logged in this period'} />
        <Tile label="Interested replies" value={cur.filter((t) => t.positive).length.toLocaleString()} sub="emails only" />
      </div>

      {capped && <p className="text-xs text-muted-foreground">Email history is read from the most recent 5,000 sends per source, so the oldest weeks of a year view may be short.</p>}

      <Section title="Touches per week">
        <div className="rounded-xl border border-border bg-white p-4"><WeeklyChart weeks={weekly} target={overall} /></div>
      </Section>

      <Section title="Who we reached" hint="By the type recorded on each person. Someone with several types is counted under the first that applies: buyers, then recruiters, coaches, higher ed, researchers, funders, partners, candidates.">
        {groups.length === 0 ? <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">No outreach in the last {rangeLabel}.</p> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th scope="col" className="p-3">Type of person</th><th scope="col" className="p-3">Automated email</th><th scope="col" className="p-3">Email by hand</th><th scope="col" className="p-3">Calls</th><th scope="col" className="p-3">LinkedIn and texts</th><th scope="col" className="p-3">Total</th><th scope="col" className="p-3">Responded</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.group} className="border-t border-border">
                    <th scope="row" className="p-3 text-left font-medium">{PERSON_GROUP_LABEL[g.group]}</th>
                    <td className="p-3 tabular-nums">{g.automatedEmail}</td><td className="p-3 tabular-nums">{g.manualEmail}</td><td className="p-3 tabular-nums">{g.calls}</td><td className="p-3 tabular-nums">{g.linkedinText}</td>
                    <td className="p-3 font-medium tabular-nums">{g.all.sent}</td>
                    <td className="p-3 tabular-nums">{g.all.responded} ({fmtRate(g.all)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="What kind" hint="Calls count as a response when they connect. Calls logged without an outcome count as not connected. A LinkedIn message or text counts when they write back within two weeks.">
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th scope="col" className="p-3">Kind</th><th scope="col" className="p-3">Sent</th><th scope="col" className="p-3">Responded</th><th scope="col" className="p-3">Interested</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-t border-border">
                  <th scope="row" className="p-3 text-left font-medium">{s.source} <Chip tone={s.mode === 'automated' ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'}>{s.mode === 'automated' ? 'Automated' : 'By hand'}</Chip></th>
                  <td className="p-3 tabular-nums">{s.tally.sent}</td><td className="p-3 tabular-nums">{s.tally.responded} ({fmtRate(s.tally)})</td><td className="p-3 tabular-nums">{s.tally.positive || '–'}</td>
                </tr>
              ))}
              {sources.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={4}>Nothing in the last {rangeLabel}.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Time of day" hint={`Eastern time. Bars are how much went out; dots are how often people responded. Hours with fewer than ${MIN_FOR_RATE} touches have no dot.${noTime ? ` ${noTime} logged without a time are left out.` : ''}`}>
        <div className="rounded-xl border border-border bg-white p-4"><BucketChart buckets={hours} labels={HOUR_LABELS} labelEvery={3} unit="Touches" ariaLabel="Touches and response rate by hour of day" /></div>
      </Section>

      <Section title="Day of the week">
        <div className="rounded-xl border border-border bg-white p-4"><BucketChart buckets={weekdays} labels={[...WEEKDAYS]} unit="Touches" ariaLabel="Touches and response rate by day of the week" /></div>
      </Section>
    </div>
  )
}
