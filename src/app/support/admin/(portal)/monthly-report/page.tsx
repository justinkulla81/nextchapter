import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { getStoredReport, listReportMonths } from '@/lib/reports/monthly-user/store'
import { isValidMonthKey, monthKeyOf, monthWindow } from '@/lib/reports/monthly-user/period'
import { formatValue } from '@/lib/reports/monthly-user/stats'
import type { Block, Kpi, MonthlyUserReportData, Section, StatRow, TrendPoint } from '@/lib/reports/monthly-user/types'
import { GenerateReportButton } from './GenerateReportButton'
import { MonthPicker } from './MonthPicker'
import { ReportViewed } from './ReportViewed'

export const metadata: Metadata = { title: 'Monthly member report', robots: { index: false, follow: false } }
export const maxDuration = 60

function Change({ value, prior, unit }: { value: number | null; prior: number | null | undefined; unit: StatRow['unit'] }) {
  if (value === null || prior === null || prior === undefined) return <span className="text-xs text-muted-foreground">no prior month</span>
  const d = Math.round((value - prior) * 10) / 10
  if (d === 0) return <span className="text-xs text-muted-foreground">flat</span>
  return <span className="text-xs text-muted-foreground tabular-nums">{d > 0 ? '+' : ''}{d}{unit === 'pct' ? ' pts' : ''} vs last month</span>
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{kpi.label}</p>
      <p className="text-2xl font-semibold tabular-nums">{formatValue(kpi.value, kpi.unit)}</p>
      <Change value={kpi.value} prior={kpi.prior} unit={kpi.unit} />
    </div>
  )
}

function BlockTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            {head.map((h, i) => <th key={h + i} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Hidden({ count }: { count: number }) {
  if (count === 0) return null
  return <p className="text-xs text-muted-foreground">{count} smaller group{count === 1 ? '' : 's'} not shown (fewer than 5 members each, or beyond the top of the list).</p>
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'distribution') {
    const { dist } = block
    return (
      <div className="space-y-1">
        <BlockTitle title={block.title} note={block.note} />
        {dist.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough members to show this yet. Groups under 5 are never shown.</p>
        ) : (
          <Table head={['Group', 'Members', 'Share']}>
            {dist.rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 tabular-nums">{r.count}</td>
                <td className="px-3 py-2 tabular-nums">{r.share}%</td>
              </tr>
            ))}
          </Table>
        )}
        <p className="text-xs text-muted-foreground">{dist.n} answered · {dist.unknown} no answer</p>
        <Hidden count={dist.hiddenGroups} />
      </div>
    )
  }
  if (block.kind === 'stats') {
    return (
      <div className="space-y-1">
        <BlockTitle title={block.title} note={block.note} />
        {block.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough members to show this yet.</p>
        ) : (
          <Table head={['Measure', 'This month', 'Change']}>
            {block.rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2">{r.label}{r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}</td>
                <td className="px-3 py-2 tabular-nums">{formatValue(r.value, r.unit)}</td>
                <td className="px-3 py-2">{r.prior !== undefined ? <Change value={r.value} prior={r.prior} unit={r.unit} /> : null}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    )
  }
  if (block.kind === 'comparison') {
    return (
      <div className="space-y-1">
        <BlockTitle title={block.title} note={block.note} />
        {block.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough members in any group to compare. Groups under 5 are never shown.</p>
        ) : (
          <Table head={['Group', 'Members', ...block.columns.map((c) => c.label)]}>
            {block.rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 tabular-nums">{r.n}</td>
                {block.columns.map((c) => <td key={c.key} className="px-3 py-2 tabular-nums">{formatValue(r.values[c.key], c.unit)}</td>)}
              </tr>
            ))}
          </Table>
        )}
        <Hidden count={block.hiddenGroups} />
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <BlockTitle title={block.title} note={block.note} />
      <Table head={['Measure', 'Compared with', 'Correlation', 'Members', 'Strength']}>
        {block.rows.map((r) => (
          <tr key={r.a + r.b} className="border-t border-border">
            <td className="px-3 py-2">{r.a}</td>
            <td className="px-3 py-2">{r.b}</td>
            <td className="px-3 py-2 tabular-nums">{r.rho === null ? '—' : r.rho}</td>
            <td className="px-3 py-2 tabular-nums">{r.n}</td>
            <td className="px-3 py-2">{r.strength === 'insufficient' ? 'Not enough members' : r.strength === 'none' ? 'No relationship' : r.strength}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

function SectionView({ section }: { section: Section }) {
  return (
    <section id={section.id} className="space-y-4 rounded-lg border border-border p-5 scroll-mt-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
        <p className="text-sm text-muted-foreground">{section.intro}</p>
      </div>
      {section.blocks.map((b, i) => <BlockView key={b.title + i} block={b} />)}
    </section>
  )
}

function Trend({ trend, headline }: { trend: TrendPoint[]; headline: Kpi[] }) {
  if (trend.length < 2) return null
  return (
    <section className="space-y-2 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Trend</h2>
        <p className="text-sm text-muted-foreground">The headline measures across the last {trend.length} months.</p>
      </div>
      <Table head={['Measure', ...trend.map((t) => t.label)]}>
        {headline.map((k) => (
          <tr key={k.key} className="border-t border-border">
            <td className="px-3 py-2">{k.label}</td>
            {trend.map((t) => <td key={t.monthKey} className="px-3 py-2 tabular-nums">{formatValue(t.kpis[k.key] ?? null, k.unit)}</td>)}
          </tr>
        ))}
      </Table>
    </section>
  )
}

function ReportView({ report }: { report: MonthlyUserReportData }) {
  const toneClass = { good: 'text-green-700', watch: 'text-red-600', info: 'text-foreground' } as const
  const toneLabel = { good: 'Good news', watch: 'Worth a look', info: 'Pattern' } as const
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-6 rounded-lg border border-border p-5 md:grid-cols-4">
        {report.headline.map((k) => <KpiTile key={k.key} kpi={k} />)}
      </section>
      {report.insights.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border p-5">
          <h2 className="text-lg font-semibold tracking-tight">What stood out</h2>
          <ul className="space-y-2 text-sm">
            {report.insights.map((i) => (
              <li key={i.title}>
                <span className={`font-medium ${toneClass[i.tone]}`}>{toneLabel[i.tone]}: </span>
                <a href={`#${i.sectionId}`} className="underline underline-offset-4">{i.title}.</a> {i.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Trend trend={report.trend} headline={report.headline} />
      <nav aria-label="Report sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {report.sections.map((s) => <a key={s.id} href={`#${s.id}`} className="underline underline-offset-4">{s.title}</a>)}
      </nav>
      {report.sections.map((s) => <SectionView key={s.id} section={s} />)}
    </div>
  )
}

export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin()
  const { month } = await searchParams
  const stored = await listReportMonths()
  const currentKey = monthKeyOf(new Date())
  const selected = month && isValidMonthKey(month) ? month : stored[0] ?? currentKey
  const report = await getStoredReport(selected)
  const pickerKeys = [...new Set([...stored, ...(stored.includes(selected) ? [] : [selected])])]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Monthly member report</h1>
        <p className="text-sm text-muted-foreground">
          Built automatically on the last day of each month and emailed to you. Every group under 5 members is hidden, and
          nothing here names a person. Comparisons show association, not cause.
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <MonthPicker months={pickerKeys.map((k) => ({ key: k, label: monthWindow(k).label }))} selected={selected} />
          {report && (
            <a href={`/api/admin/monthly-report/export?month=${selected}`} className="inline-flex h-9 items-center text-sm text-brand underline underline-offset-4">
              Export CSV
            </a>
          )}
        </div>
      </header>

      {report ? (
        <>
          <ReportViewed monthKey={selected} memberCount={report.data.memberCount} />
          <p className="text-xs text-muted-foreground">
            {report.data.label} · {report.data.memberCount} members · built {report.generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC
            ({report.trigger === 'manual' ? 'built by hand' : 'month-end run'}){report.emailedAt ? ' · emailed' : ''}
          </p>
          <ReportView report={report.data} />
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Data changed since this was built? Rebuilding replaces this month&apos;s report.</p>
            <GenerateReportButton monthKey={selected} label={report.data.label} />
          </div>
        </>
      ) : (
        <section className="space-y-3 rounded-lg border border-border p-5">
          <h2 className="text-lg font-semibold">No report for {monthWindow(selected).label} yet</h2>
          <p className="text-sm text-muted-foreground">
            The report is built automatically on the last day of the month. You can build it now to see the month so far.
            If this is the first run, apply <code>prisma/manual/2026-10-14-monthly-user-report.sql</code> first.
          </p>
          <GenerateReportButton monthKey={selected} label={monthWindow(selected).label} />
        </section>
      )}
    </div>
  )
}
