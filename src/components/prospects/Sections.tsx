import type { ReactNode } from 'react'
import { functionLabel, type NoticeSummary, type Opening } from '@/lib/prospects/market'
import { REPORT_URL } from '@/lib/prospects/config'

const n0 = (n: number) => n.toLocaleString('en-US')
const money = (n: number | null) => (n == null ? 'Not posted' : `$${Math.round(n / 1000)}k`)
const LEVEL: Record<string, string> = { MANAGER: 'Manager', SENIOR_MANAGER: 'Senior manager', DIRECTOR: 'Director', VP: 'VP', SENIOR_IC: 'Senior', MID_LEVEL: 'Mid-level' }

export function Section({ id, eyebrow, title, children }: { id?: string; eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-5 py-10" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="space-y-2">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h2 id={id ? `${id}-h` : undefined} className="font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function StatStrip({ stats }: { stats: { value: string; label: string; note?: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white p-5">
          <dd className="font-serif text-4xl font-semibold tracking-tight text-navy tabular-nums">{s.value}</dd>
          <dt className="mt-1 text-sm font-medium text-foreground">{s.label}</dt>
          {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
        </div>
      ))}
    </dl>
  )
}

export function Openings({ rows, place }: { rows: Opening[]; place: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No postings with listed pay in {place} right now.</p>
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Real open roles in {place}</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Role</th><th className="p-3">Company</th><th className="p-3">Level</th><th className="p-3 text-right">Posted pay</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.url} className="border-t border-border align-top">
              <td className="p-3 font-medium text-navy"><a href={r.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{r.title}</a>{r.fn && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{functionLabel(r.fn)}</span>}</td>
              <td className="p-3">{r.company}</td>
              <td className="p-3">{r.level ? LEVEL[r.level] ?? r.level : ''}</td>
              <td className="p-3 text-right tabular-nums">{money(r.pay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Bars({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((i) => (
          <li key={i.label} className="text-sm">
            <div className="flex justify-between gap-3"><span className="truncate">{i.label}</span><span className="tabular-nums text-muted-foreground">{n0(i.value)}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-navy/70" style={{ width: `${(100 * i.value) / max}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LayoffList({ summary, scope }: { summary: NoticeSummary; scope: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-navy">Layoff notices in {scope}, last {Math.round(summary.days / 30)} months</h3>
      <p className="mt-1 text-sm text-muted-foreground">{n0(summary.notices)} state filings covering {n0(summary.jobs)} jobs at {summary.employers} employers.</p>
      <ul className="mt-3 divide-y divide-border text-sm">
        {summary.top.map((t) => (
          <li key={t.employer + t.noticeDate.toISOString()} className="flex justify-between gap-3 py-2"><span>{t.employer}</span><span className="tabular-nums text-muted-foreground">{n0(t.employees)} jobs · {t.dateKind === 'effective' ? 'effective ' : ''}{t.noticeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Public state WARN filings.</p>
    </div>
  )
}

export function LongSearchCard() {
  return (
    <div className="rounded-2xl border border-orange/30 bg-orange/5 p-5">
      <p className="font-serif text-4xl font-semibold text-navy tabular-nums">28%</p>
      <p className="mt-1 text-sm font-medium">of unemployed white-collar workers have been looking for 27 weeks or more this year, up from 23% a year ago.</p>
      <p className="mt-2 text-xs text-muted-foreground">Unemployment is low overall, but white-collar searches are running longer. From our monthly report on Census and BLS data, methods published. <a className="underline underline-offset-4" href={REPORT_URL} target="_blank" rel="noopener noreferrer">Read the report</a>.</p>
    </div>
  )
}

export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-2xl border border-border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
          <h3 className="mt-1 font-semibold text-navy">{s.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
  )
}

/** What the partner would see once people join. Every number is an empty state on purpose: nothing here is invented. */
export function DashboardPreview({ org, stay }: { org: string; stay: string }) {
  const cells = ['Joined', 'Engaged', 'Interviewing', 'Landed', stay]
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold text-navy">{org}: outcomes at a glance</h3><p className="text-xs text-muted-foreground">Your view, before anyone has joined</p></div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cells.map((c) => (
          <li key={c} className="rounded-xl bg-off-white p-3"><p className="font-serif text-2xl text-navy tabular-nums">0</p><p className="mt-1 text-xs text-muted-foreground">{c}</p></li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">Counts only, never names, and a number appears once 10 or more people have joined. Each person chooses what to share. These zeros are real: nobody has joined yet, so nothing on this page is made up.</p>
    </div>
  )
}

export function PrivacyNote({ asOf }: { asOf: Date }) {
  return (
    <p className="border-t border-border pt-6 text-xs text-muted-foreground">
      Prepared {asOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} from public data: our job database (open roles seen in the last 14 days), state WARN filings, Census Bureau and BLS figures, and our published monthly report.
      This page is unlisted and shows no personal information. Roles link to the employers&apos; own postings.
    </p>
  )
}
