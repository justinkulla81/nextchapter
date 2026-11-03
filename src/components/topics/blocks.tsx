import Link from 'next/link'
import Image from 'next/image'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { StructuredData } from '@/components/StructuredData'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { costLabel, whenLabel, whereLabel } from '@/lib/events/format'
import { SPEAKING_LABEL, type Speaking } from '@/lib/events/types'
import { conferencePath, functionPath, industryPath } from '@/lib/seo/topics'
import type { Conf, TopicJob } from '@/lib/seo/topic-data'
import { PageCaptureTop, PageCaptureOwner } from '@/components/capture/PageCapture'
import { PullCtaTop, pullContext, withPullCtas } from '@/components/capture/PullCta'
import type { PageCaptureConfig } from '@/lib/capture/page-capture'
import { FACT_LINKS, type Fact } from '@/lib/seo/topic-quality'

export const LINK = 'text-brand underline underline-offset-4'

// Each section sits on its own soft color so a long page reads as a set of panels, not one white wall. The color is picked from the
// section id, so it never changes between renders; a page can pass `tone` to choose.
const TONES = [
  { bg: 'bg-tint-sky', bar: 'bg-light-blue', top: 'border-t-light-blue' },
  { bg: 'bg-tint-sun', bar: 'bg-orange', top: 'border-t-orange' },
  { bg: 'bg-tint-mint', bar: 'bg-success', top: 'border-t-success' },
  { bg: 'bg-tint-plum', bar: 'bg-accent-employer', top: 'border-t-accent-employer' },
] as const
const toneFor = (id: string, tone?: number) => TONES[(tone ?? [...id].reduce((n, c) => n + c.charCodeAt(0), 0)) % TONES.length]
export const H2 = 'text-2xl font-bold tracking-tight text-navy'
const CARD = 'rounded-xl border border-border bg-white p-5'

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Page frame shared by every topic page: header, breadcrumb, h1, intro, footer. */
export function TopicShell({ trail, title, intro, children, jsonLd, capture, hero }: {
  trail: { name: string; path: string }[]
  title: string
  intro: string
  children: React.ReactNode
  jsonLd?: Record<string, unknown>[]
  /** Adds the journey question and email save under the intro and the owner inquiry at the bottom (components/capture). */
  capture?: PageCaptureConfig
  /** A picture for the header (public/images/topics). Without one the header is plain text. */
  hero?: string
}) {
  const pull = pullContext(trail)
  const { body, bottom } = withPullCtas(children, pull, { hasCapture: !!capture, isOwnBand: (el) => el.type === JoinBand })
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd(trail)} />
      {jsonLd?.map((d, i) => <StructuredData key={i} data={d} />)}
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className={hero ? 'overflow-hidden rounded-3xl bg-gradient-to-br from-tint-sky via-white to-tint-sun md:grid md:grid-cols-[1.15fr_1fr]' : undefined}>
            <div className={hero ? 'p-5 sm:p-7' : undefined}>
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
            </div>
            {hero && (
              <div className="relative order-first aspect-[16/7] md:order-none md:aspect-auto md:min-h-[260px]">
                <Image src={hero} alt="" fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover object-right" />
              </div>
            )}
          </div>
          {body}
          {capture ? <PageCaptureTop capture={capture} /> : <PullCtaTop {...pull} />}
          {capture && <PageCaptureOwner capture={capture} />}
          {bottom}
        </div>
      </main>
      <PublicSiteFooter page="seo" cta={false} />
    </div>
  )
}

export function Section({ id, title, note, children, tone }: { id: string; title: string; note?: string; children: React.ReactNode; tone?: number }) {
  const t = toneFor(id, tone)
  return (
    <section aria-labelledby={id} className={`mt-8 rounded-3xl p-5 sm:p-7 ${t.bg}`}>
      <h2 id={id} className={`${H2} flex items-center gap-3`}><span aria-hidden className={`h-6 w-1.5 shrink-0 rounded-full ${t.bar}`} />{title}</h2>
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

export function JoinBand({ source, what }: { source: string; what: string }) {
  return (
    <section className="mt-8 rounded-3xl bg-gradient-to-br from-brand to-light-blue p-6 text-white sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">See how the market reads your background</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/90">
        NextChapter is the leading job transition platform. A free account gives you a plain-language read on {what}, matched jobs and a weekly action plan.
      </p>
      <TrackedLink href={PERSONALIZE_HREF} event="topic_cta_clicked" properties={{ source }} className="mt-4 inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95">
        Join free
      </TrackedLink>
    </section>
  )
}

export const industryChip = (name: string, count?: number) => ({ href: industryPath(name), label: name, detail: count != null ? count.toLocaleString() : undefined })
export const functionChip = (name: string, count?: number) => ({ href: functionPath(name), label: name, detail: count != null ? count.toLocaleString() : undefined })

/** Sourced facts: every number says where it comes from and for what period. */
export function FactGrid({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((f, i) => (
        <div key={f.key} className={`${CARD} border-t-4 ${TONES[i % TONES.length].top}`}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
          <dd className="mt-1 text-base font-semibold text-navy">{f.value}</dd>
          <p className="mt-1 text-xs text-muted-foreground">Source: {f.source}{f.period ? `, ${f.period}` : ''}.</p>
          {(f.href ?? FACT_LINKS[f.key]) && (
            <TrackedLink href={(f.href ?? FACT_LINKS[f.key])!} event="stat_link_clicked" properties={{ fact: f.key }} className="mt-2 inline-block text-xs font-medium text-brand underline underline-offset-4">See the detail →</TrackedLink>
          )}
        </div>
      ))}
    </dl>
  )
}

/** Top skills / states as plain lists with counts. */
export function RankList({ title, items, tone = 0 }: { title: string; items: { label: string; detail?: string }[]; tone?: number }) {
  if (items.length === 0) return null
  return (
    <div className={`${CARD} border-t-4 ${TONES[tone % TONES.length].top}`}>
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((i, idx) => (
          <li key={i.label} className="flex justify-between gap-3"><span>{idx + 1}. {i.label}</span>{i.detail && <span className="tabular-nums">{i.detail}</span>}</li>
        ))}
      </ol>
    </div>
  )
}
