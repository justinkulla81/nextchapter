import Link from 'next/link'
import { H2 } from '@/components/seo/SeoPage'
import type { EmployerInsights as Insights } from '@/lib/seo/employer-insights'
import { monthLabel, type InsightText } from '@/lib/seo/employer-insight-text'

const n0 = (n: number) => n.toLocaleString('en-US')
const pctOf = (x: number | null) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`)

/** The 12-month bar chart: roles first seen per month. Inline SVG, labelled for screen readers and crawlers. */
function TrendChart({ months, name }: { months: { month: string; opened: number }[]; name: string }) {
  const max = Math.max(1, ...months.map((m) => m.opened))
  const w = 480
  const h = 120
  const bar = w / months.length
  const summary = `${name} professional roles opened per month, ${monthLabel(months[0].month)} to ${monthLabel(months[months.length - 1].month)}: ${months.map((m) => `${monthLabel(m.month)} ${m.opened}`).join(', ')}.`
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label={summary} className="w-full max-w-xl">
        {months.map((m, i) => {
          const bh = Math.round((m.opened / max) * h)
          return (
            <g key={m.month}>
              <rect x={i * bar + 4} y={h - bh} width={bar - 8} height={bh} rx={3} className="fill-brand" />
              <text x={i * bar + bar / 2} y={h + 14} textAnchor="middle" fontSize="10" className="fill-muted-foreground">{monthLabel(m.month)}</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">Professional roles first seen on {name}’s career site, by month.</figcaption>
    </figure>
  )
}

export function EmployerInsights({ name, industry, ins, text }: { name: string; industry: string | null; ins: Insights; text: InsightText }) {
  const { live, history, benchmark, similar } = ins
  const showTrend = history.opened12mo >= 3 && history.months.length >= 3
  const compare = benchmark
    ? [
        { label: 'Open professional roles', you: n0(live.open), industry: n0(benchmark.medianOpen) },
        { label: 'Roles that post a salary range', you: pctOf(ins.profile.postedPayShare), industry: pctOf(benchmark.medianPostedPayShare) },
        { label: 'Roles that are remote', you: pctOf(ins.profile.remoteShare), industry: pctOf(benchmark.medianRemoteShare) },
      ]
    : []
  const rows = compare.filter((c) => !(c.you === c.industry && (c.you === '0%' || c.you === 'n/a')))
  return (
    <>
      {text.glance.length > 0 && (
        <section aria-labelledby="glance" className="mt-12">
          <h2 id="glance" className={H2}>{name} hiring at a glance</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {text.glance.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </section>
      )}

      {showTrend && (
        <section aria-labelledby="trend" className="mt-12">
          <h2 id="trend" className={H2}>Hiring trend, last 12 months</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{n0(history.opened12mo)} professional roles opened{history.months.length < 12 ? ` since we began tracking ${name} in ${monthLabel(history.months[0].month)}` : ' in the last 12 months'}.</p>
          <TrendChart months={history.months} name={name} />
        </section>
      )}

      {(live.topSkills.length >= 3 || live.aiTools.length > 0 || live.aiCerts.length > 0) && (
        <section aria-labelledby="asks" className="mt-12">
          <h2 id="asks" className={H2}>What {name} asks for</h2>
          {live.topSkills.length >= 3 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-navy">Skills named most often in open roles</h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {live.topSkills.map((s) => (
                  <li key={s.name} className="rounded-full border border-border bg-white px-3 py-1">{s.name} <span className="text-xs tabular-nums text-muted-foreground">{n0(s.count)}</span></li>
                ))}
              </ul>
            </div>
          )}
          {(live.aiTools.length > 0 || live.aiCerts.length > 0) && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
              {live.aiTools.length > 0 && <><span className="font-medium text-foreground">AI tools named:</span> {live.aiTools.map((t) => `${t.name} (${n0(t.count)})`).join(', ')}. </>}
              {live.aiCerts.length > 0 && <><span className="font-medium text-foreground">AI certifications named:</span> {live.aiCerts.map((t) => `${t.name} (${n0(t.count)})`).join(', ')}.</>}
            </p>
          )}
        </section>
      )}

      {(live.noExpExamples.length > 0 || live.trainingExample) && (
        <section aria-labelledby="entry" className="mt-12">
          <h2 id="entry" className={H2}>Entry-level roles, in the employer’s words</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Phrases from open postings that say people without experience are welcome or that training is provided.</p>
          <ul className="mt-4 max-w-3xl space-y-3 text-sm">
            {live.noExpExamples.map((x) => (
              <li key={x.id} className="rounded-xl border border-border bg-white p-4"><span className="text-muted-foreground">“{x.phrase}”</span><span className="mt-1 block text-xs text-muted-foreground">{x.title}</span></li>
            ))}
            {live.trainingExample && (
              <li className="rounded-xl border border-border bg-white p-4"><span className="text-muted-foreground">“{live.trainingExample.phrase}”</span><span className="mt-1 block text-xs text-muted-foreground">{live.trainingExample.title} (training provided)</span></li>
            )}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="compare" className="mt-12">
          <h2 id="compare" className={H2}>How {name} compares{industry ? ` with ${industry} employers` : ''}</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">{name} against the median {industry} employer we track ({n0(benchmark!.employers)} employers)</caption>
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr><th scope="col" className="p-3">Measure</th><th scope="col" className="p-3">{name}</th><th scope="col" className="p-3">Median employer</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.label} className="border-b border-border last:border-0"><td className="p-3">{c.label}</td><td className="p-3 tabular-nums">{c.you}</td><td className="p-3 tabular-nums">{c.industry}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Median across {n0(benchmark!.employers)} {industry} employers with 3 or more open roles. Updated daily.</p>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-12">
          <h2 id="similar" className={H2}>Similar employers hiring</h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {similar.map((s) => (
              <li key={s.slug}><Link href={`/employers/${s.slug}`} className="inline-flex items-baseline gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-navy hover:border-brand">{s.name} <span className="text-xs tabular-nums text-muted-foreground">{n0(s.open)} open</span></Link></li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
