import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { StructuredData } from '@/components/StructuredData'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { costLabel, whenLabel, whereLabel } from '@/lib/events/format'
import { SPEAKING_LABEL, type Speaking } from '@/lib/events/types'
import { conferencePath, functionPath, industryPath } from '@/lib/seo/topics'
import type { Conf, TopicJob, TopicNotice } from '@/lib/seo/topic-data'

export const LINK = 'text-brand underline underline-offset-4'
export const H2 = 'text-2xl font-bold tracking-tight text-navy'
const CARD = 'rounded-xl border border-border bg-white p-5'

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Page frame shared by every topic page: header, breadcrumb, h1, intro, footer. */
export function TopicShell({ trail, title, intro, children, jsonLd }: {
  trail: { name: string; path: string }[]
  title: string
  intro: string
  children: React.ReactNode
  jsonLd?: Record<string, unknown>[]
}) {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd(trail)} />
      {jsonLd?.map((d, i) => <StructuredData key={i} data={d} />)}
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {trail.map((t, i) => (
              <span key={t.path}>
                <span aria-hidden> › </span>
                {i === trail.length - 1 ? <span className="text-foreground">{t.name}</span> : <Link href={t.path} className="hover:text-foreground">{t.name}</Link>}
              </span>
            ))}
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{intro}</p>
          {children}
        </div>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}

export function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      {note && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Chips({ items, event, kind }: { items: { href: string; label: string; detail?: string }[]; event: string; kind: string }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i.href}>
          <TrackedLink href={i.href} event={event} properties={{ kind, to: i.href }} className="inline-flex items-baseline gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-navy hover:border-brand">
            {i.label}
            {i.detail && <span className="text-xs tabular-nums text-muted-foreground">{i.detail}</span>}
          </TrackedLink>
        </li>
      ))}
    </ul>
  )
}

export function JobList({ jobs, total, source, allHref }: { jobs: TopicJob[]; total: number; source: string; allHref?: string }) {
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">No verified open jobs in this area right now. Check back soon, or <Link href="/jobs" className={LINK}>search all jobs</Link>.</p>
  return (
    <>
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {jobs.map((j) => (
          <li key={j.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
            <div className="min-w-0">
              <TrackedLink href={`/jobs/${j.id}`} event="topic_job_clicked" properties={{ source, jobId: j.id }} className="font-medium text-navy hover:underline">{j.title}</TrackedLink>
              <p className="text-sm text-muted-foreground">{j.company}{j.location ? ` · ${j.location}` : ''}</p>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">{j.pay ? `${j.pay} · ` : ''}{day(j.postedAt)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Showing the newest {jobs.length} of about {total.toLocaleString()} verified open jobs here.{' '}
        <Link href={allHref ?? '/jobs'} className={LINK}>Search all jobs</Link>
      </p>
    </>
  )
}

export function ConferenceList({ rows, total, upcoming, source }: { rows: Conf[]; total: number; upcoming?: number; source: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No conferences are tagged to this area yet.</p>
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((c) => (
          <li key={c.id} className={CARD}>
            <TrackedLink href={conferencePath(c.id)} event="topic_conference_clicked" properties={{ source, conferenceId: c.id }} className="font-semibold text-navy hover:underline">{c.name}</TrackedLink>
            <p className="mt-1 text-sm text-muted-foreground">{whenLabel(c)}{whereLabel(c) ? ` · ${whereLabel(c)}` : ''}</p>
            <p className="mt-1 text-sm text-muted-foreground">{clip(costLabel(c), 130)}</p>
            {c.speaking === 'OPEN_CFP' && <p className="mt-1 text-sm font-medium text-navy">{SPEAKING_LABEL[c.speaking as Speaking]}{c.speakingDeadline ? ` · deadline ${day(c.speakingDeadline.toISOString())}` : ''}</p>}
          </li>
        ))}
      </ul>
      {total > rows.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {rows.length} of {total.toLocaleString()} conferences{upcoming != null ? `, ${upcoming.toLocaleString()} with dates announced` : ''}.
        </p>
      )}
    </>
  )
}

export function NoticeList({ notices, source, limit = 12 }: { notices: TopicNotice[]; source: string; limit?: number }) {
  if (notices.length === 0) return <p className="text-sm text-muted-foreground">No WARN layoff notices matched here in the last 12 months.</p>
  const shown = notices.slice(0, limit)
  const workers = notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{notices.length.toLocaleString()} notices in the last 12 months{workers ? `, naming ${workers.toLocaleString()} workers` : ''}.</p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {shown.map((n) => (
          <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <TrackedLink href={`/layoffs/company/${n.slug}`} event="topic_layoff_clicked" properties={{ source, slug: n.slug }} className="font-medium text-navy hover:underline">{n.employer}</TrackedLink>
            <span className="tabular-nums text-muted-foreground">
              {n.workers ? `${n.workers.toLocaleString()} workers · ` : ''}{n.state} · {day(n.noticeDate)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Source: state WARN filings. <Link href="/layoffs" className={LINK}>See the full layoff tracker</Link></p>
    </>
  )
}

export function JoinBand({ source, what }: { source: string; what: string }) {
  return (
    <section className="mt-12 rounded-xl border border-border bg-white p-6">
      <h2 className="text-xl font-semibold tracking-tight text-navy">See how the market reads your background</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        NextChapter is the leading job transition platform. A free account gives you a plain-language read on {what}, matched jobs and a weekly action plan.
      </p>
      <TrackedLink href={PERSONALIZE_HREF} event="topic_cta_clicked" properties={{ source }} className="mt-4 inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95">
        Start free
      </TrackedLink>
    </section>
  )
}

export const industryChip = (name: string, count?: number) => ({ href: industryPath(name), label: name, detail: count != null ? count.toLocaleString() : undefined })
export const functionChip = (name: string, count?: number) => ({ href: functionPath(name), label: name, detail: count != null ? count.toLocaleString() : undefined })
