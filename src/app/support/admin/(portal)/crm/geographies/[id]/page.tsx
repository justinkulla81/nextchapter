import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { KIND_LABELS, localFirst, money, pct, num } from '@/lib/geo/filters'
import { FitScoreBadge, type FitBreakdown } from '@/components/admin/FitScoreBadge'

type College = { name: string; control: string; level: string; size: string | null; web: string | null }
type Board = { statewide?: boolean; id: string; name: string; website: string | null; directorName: string | null; directorTitle: string | null; directorEmail: string | null; directorPhone: string | null }
type DataCenter = { name: string; operator: string | null }
type Employer = { employer: string; workers: number }
type NewsItem = { title: string; url: string; publisher?: string; publishedAt?: string }

function yearAgo(): Date {
  return new Date(Date.now() - 365 * 86_400_000)
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export default async function GeographyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const a = await prisma.geoArea.findUnique({ where: { id }, include: { orgLeads: { orderBy: { revenue: 'desc' }, take: 25 } } })
  if (!a) notFound()

  const state = a.level === 'COUNTY' ? await prisma.geoArea.findFirst({ where: { level: 'STATE', state: a.state } }) : null
  const warn = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, state: a.state, ...(a.level === 'COUNTY' ? { county: { contains: a.name.replace(/ (County|Parish|Borough)$/i, ''), mode: 'insensitive' as const } } : {}), noticeDate: { gte: yearAgo() } },
    orderBy: { employees: { sort: 'desc', nulls: 'last' } },
    take: 25,
    select: { id: true, employer: true, employees: true, noticeDate: true, effectiveDate: true, industry: true, sourceUrl: true },
  })
  const colleges = (a.higherEd as College[] | null) ?? []
  const boards = localFirst((a.wioaBoards as Board[] | null) ?? [])
  const dcs = (a.dataCenters as DataCenter[] | null) ?? []
  const employers = (a.majorEmployers as Employer[] | null) ?? []
  const news = (a.news as NewsItem[] | null) ?? []
  const delta = a.unemploymentRate != null && a.unemploymentRatePrior != null ? a.unemploymentRate - a.unemploymentRatePrior : null
  const vs = (v: number | null, s: number | null | undefined) => (v != null && s != null ? (v - s) : null)
  const incVsState = vs(a.medianHouseholdIncome, state?.medianHouseholdIncome)
  const title = a.level === 'STATE' ? a.name : `${a.name}, ${a.state}`

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/geographies" className="text-sm text-brand hover:underline">All geographies</Link>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <Link href={`/support/admin/crm/pitch?area=${a.id}`} className="mt-2 inline-block rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Build a pitch for {a.name}</Link>
        <p className="mt-1 text-sm text-muted-foreground">
          Population {num(a.population)}. Unemployment as of {a.unemploymentAsOf ?? 'unknown'}. This page is the appendix for a pitch to anyone in {title}.
        </p>
      </header>

      <section aria-labelledby="numbers" className="space-y-3">
        <h2 id="numbers" className="text-lg font-semibold">The numbers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Unemployment rate" value={pct(a.unemploymentRate)} note={delta == null ? undefined : `${delta > 0 ? 'Up' : delta < 0 ? 'Down' : 'Flat'} ${Math.abs(delta).toFixed(1)} points from a year ago${state?.unemploymentRate != null ? `; state ${pct(state.unemploymentRate)}` : ''}`} />
          <Stat label="White-collar unemployment (estimate)" value={pct(a.wcUnemploymentEst)} note="Modeled from the county rate and its white-collar share" />
          <Stat label="Blue-collar unemployment (estimate)" value={pct(a.bcUnemploymentEst)} note="Same method" />
          <Stat label="White-collar share of workers" value={a.whiteCollarShare == null ? '–' : pct(a.whiteCollarShare * 100, 0)} note={state?.whiteCollarShare != null ? `State ${pct(state.whiteCollarShare * 100, 0)}` : undefined} />
          <Stat label="Median household income" value={money(a.medianHouseholdIncome)} note={incVsState == null ? undefined : `${incVsState >= 0 ? '$' + Math.round(incVsState / 1000) + 'K above' : '$' + Math.round(-incVsState / 1000) + 'K below'} the state`} />
          <Stat label="Per-capita income" value={money(a.perCapitaIncome)} />
          <Stat label="Layoffs, last 12 months" value={num(a.layoffs12mo)} note={`${a.layoffEvents12mo} WARN filings; ${num(a.layoffs90d)} workers in the last 90 days`} />
          <Stat label="Labor force" value={num(a.laborForce)} />
        </div>
      </section>

      <section aria-labelledby="layoffs" className="space-y-2">
        <h2 id="layoffs" className="text-lg font-semibold">Layoff announcements, last 12 months</h2>
        <p className="text-xs text-muted-foreground">Filings that name this county. The total above also counts filings placed here by ZIP code or city, so it can be higher than this list.</p>
        {warn.length === 0 ? <p className="text-sm text-muted-foreground">No WARN filings on file for this area.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {warn.map((w) => (
              <li key={w.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="font-medium">{w.sourceUrl ? <a href={w.sourceUrl} className="text-brand hover:underline" target="_blank" rel="noreferrer">{w.employer}</a> : w.employer}</span>
                <span className="tabular-nums text-muted-foreground">{w.employees ?? '?'} workers{w.noticeDate ? ` · noticed ${w.noticeDate.toISOString().slice(0, 10)}` : ''}{w.industry ? ` · ${w.industry}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="wioa" className="space-y-2">
        <h2 id="wioa" className="text-lg font-semibold">Workforce board (WIOA)</h2>
        {boards.length === 0 ? <p className="text-sm text-muted-foreground">No board matched.</p> : boards.map((b) => (
          <div key={b.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{b.website ? <a href={b.website} className="text-brand hover:underline" target="_blank" rel="noreferrer">{b.name}</a> : b.name}</p>
            <p className="text-muted-foreground">{[b.directorName, b.directorTitle].filter(Boolean).join(', ') || 'Director not listed'}{b.directorEmail ? ` · ${b.directorEmail}` : ''}{b.directorPhone ? ` · ${b.directorPhone}` : ''}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="he" className="space-y-2">
        <h2 id="he" className="text-lg font-semibold">Higher education ({a.higherEdCount})</h2>
        {colleges.length === 0 ? <p className="text-sm text-muted-foreground">No degree-granting colleges.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {colleges.map((c) => (
              <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="font-medium">{c.web ? <a href={c.web.startsWith('http') ? c.web : `https://${c.web}`} className="text-brand hover:underline" target="_blank" rel="noreferrer">{c.name}</a> : c.name}</span>
                <span className="text-muted-foreground">{c.level} · {c.control}{c.size ? ` · ${c.size} students` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="emp" className="space-y-2">
        <h2 id="emp" className="text-lg font-semibold">Major employers</h2>
        <p className="text-xs text-muted-foreground">Employers that filed layoff notices here in the last 12 months, by workers. A full employer list needs a paid data source.</p>
        {employers.length === 0 ? <p className="text-sm text-muted-foreground">None on file.</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">{employers.map((e) => <li key={e.employer} className="rounded-md border border-border px-2.5 py-1">{e.employer} <span className="text-muted-foreground">({num(e.workers)})</span></li>)}</ul>
        )}
      </section>

      <section aria-labelledby="dc" className="space-y-2">
        <h2 id="dc" className="text-lg font-semibold">Data centers ({a.dataCenterCount})</h2>
        <p className="text-xs text-muted-foreground">From OpenStreetMap, which undercounts new and hyperscale sites.</p>
        {dcs.length === 0 ? <p className="text-sm text-muted-foreground">None mapped.</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">{dcs.map((d, i) => <li key={i} className="rounded-md border border-border px-2.5 py-1">{d.name}</li>)}</ul>
        )}
      </section>

      <section aria-labelledby="init" className="space-y-2">
        <h2 id="init" className="text-lg font-semibold">Local initiatives</h2>
        <p className="whitespace-pre-wrap text-sm">{a.initiatives ?? <span className="text-muted-foreground">Not researched yet.</span>}</p>
      </section>

      <section aria-labelledby="news" className="space-y-2">
        <h2 id="news" className="text-lg font-semibold">Recent news</h2>
        {news.length === 0 ? <p className="text-sm text-muted-foreground">Not pulled yet.</p> : (
          <ul className="space-y-1 text-sm">{news.map((n) => <li key={n.url}><a href={n.url} className="text-brand hover:underline" target="_blank" rel="noreferrer">{n.title}</a> <span className="text-muted-foreground">{n.publisher}{n.publishedAt ? ` · ${n.publishedAt.slice(0, 10)}` : ''}</span></li>)}</ul>
        )}
      </section>

      <section aria-labelledby="leads" className="space-y-2">
        <h2 id="leads" className="text-lg font-semibold">Leads in this area</h2>
        {a.orgLeads.length === 0 ? <p className="text-sm text-muted-foreground">No economic development groups, chambers or workforce nonprofits found.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {a.orgLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="font-medium"><FitScoreBadge score={l.fitScore} breakdown={l.fitBreakdown as FitBreakdown} /> {l.name}</span>
                <span className="text-muted-foreground">{KIND_LABELS[l.kind]} · {money(l.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
