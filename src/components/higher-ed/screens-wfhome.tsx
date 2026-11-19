// Workforce Hub › Home: the operator's dashboard (owner, 2026-11-18). One page for what needs doing this week, then what is happening:
// layoffs in the region, funding deadlines, trainings on offer, and news and data. A section with nothing in it is left out, so the page
// never shows an empty box. Every read is narrow and bounded; the feed is shared for 30 minutes per organization (src/lib/workforce/feed.ts).

import Link from 'next/link'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { loadFeed } from '@/lib/workforce/feed'
import { dollars } from '@/lib/workforce/funding-partners'
import { StatTile } from './StatTile'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const DAY = 86_400_000
const clock = () => Date.now()
const when = (d: Date | string | null | undefined) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '')
const SOURCE_LABEL: Record<string, string> = { UNIVERSITY: 'University or college', THIRD_PARTY: 'Third-party', LOCAL: 'Offered in your region' }

export async function WfHome({ ctx, base }: Props) {
  const id = ctx.institution.id
  const orgBase = base.replace(/\/workforce-hub$/, '')
  const now = clock()
  const [notices, apps, trainingCount, trainings, referrals, feed] = await Promise.all([
    regionNotices(id).catch(() => []),
    prisma.fundingApplication.findMany({
      where: { institutionId: id, status: { in: ['CONSIDERING', 'DRAFTING', 'SUBMITTED'] } },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
      take: 6,
      select: { id: true, name: true, funder: true, status: true, amountRequested: true, dueDate: true },
    }),
    prisma.trainingOffering.count({ where: { institutionId: id, status: 'ACTIVE' } }),
    prisma.trainingOffering.findMany({ where: { institutionId: id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, provider: true, source: true } }),
    prisma.partnerReferral.findMany({ where: { institutionId: id, status: 'SENT' }, orderBy: { createdAt: 'asc' }, take: 5, select: { id: true, title: true, dueDate: true } }),
    loadFeed(id).catch(() => []),
  ])
  const unanswered = notices.filter((n) => !n.responseId)
  const dueSoon = apps.filter((a) => a.dueDate && new Date(a.dueDate).getTime() <= now + 60 * DAY && a.status !== 'SUBMITTED')
  const news = feed.filter((i) => i.kind !== 'layoff' && !(i.kind === 'funding' && i.scope === 'region'))

  const needs: { text: string; href: string; label: string }[] = [
    ...dueSoon.slice(0, 3).map((a) => ({ text: `${a.name} is due ${when(a.dueDate)}${a.funder ? `, from ${a.funder}` : ''}`, href: `${base}/applications`, label: 'Open applications' })),
    ...(unanswered.length ? [{ text: `${unanswered.length} ${unanswered.length === 1 ? 'layoff' : 'layoffs'} in your region ${unanswered.length === 1 ? 'has' : 'have'} no rapid response yet`, href: `${orgBase}/hub/rapid`, label: 'Plan the response' }] : []),
    ...referrals.slice(0, 2).map((r) => ({ text: `Waiting on a partner: ${r.title}${r.dueDate ? `, answer due ${when(r.dueDate)}` : ''}`, href: `${orgBase}/partner-hub/referrals`, label: 'Open referrals' })),
  ]
  const tiles = [
    { label: 'Funding applications open', value: apps.length, href: `${base}/applications` },
    { label: 'Layoffs in your region', value: notices.length, href: `${orgBase}/hub/layoffs` },
    { label: 'Trainings on offer', value: trainingCount, href: `${orgBase}/education` },
    { label: 'Referrals waiting on a partner', value: referrals.length, href: `${orgBase}/partner-hub/referrals` },
  ].filter((t) => t.value > 0)

  if (!needs.length && !tiles.length && !news.length) {
    return <p className="max-w-3xl text-sm text-muted-foreground">Nothing is moving yet. Set your region under Talent Hub so the layoffs, funding and news for it show up here.</p>
  }
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">Your dashboard: what needs you this week, then what is happening in your region and nationally. Counts only; people are never named here.</p>

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} href={t.href} />
          ))}
        </div>
      )}

      {needs.length > 0 && (
        <section className="space-y-2" aria-labelledby="wf-needs">
          <h2 id="wf-needs" className="text-base font-semibold">
            Needs you
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-amber-200 bg-amber-50/60">
            {needs.map((n) => (
              <li key={n.text} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-64 font-medium">{n.text}</span>
                <Link href={n.href} className="nc-action inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notices.length > 0 && (
        <section className="space-y-2" aria-labelledby="wf-layoffs">
          <h2 id="wf-layoffs" className="text-base font-semibold">
            Layoffs in your region
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {notices.slice(0, 5).map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="font-medium">{n.sourceUrl ? <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{n.employer}</a> : n.employer}</span>
                  <span className="block text-xs text-muted-foreground">{[n.employees ? `${n.employees.toLocaleString('en-US')} workers` : null, n.county ? `${n.county} County` : n.state, n.noticeDate ? `filed ${when(n.noticeDate)}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{n.responseId ? 'Response planned' : 'No response yet'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {apps.length > 0 && (
        <section className="space-y-2" aria-labelledby="wf-funding">
          <h2 id="wf-funding" className="text-base font-semibold">
            Funding in progress
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {apps.slice(0, 5).map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="font-medium">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">{[a.funder, a.amountRequested ? `${dollars(a.amountRequested)} requested` : null, a.dueDate ? `due ${when(a.dueDate)}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {trainings.length > 0 && (
        <section className="space-y-2" aria-labelledby="wf-training">
          <h2 id="wf-training" className="text-base font-semibold">
            Trainings on offer
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {trainings.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="font-medium">{t.title}</span>
                  {t.provider && <span className="block text-xs text-muted-foreground">{t.provider}</span>}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{SOURCE_LABEL[t.source] ?? t.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {news.length > 0 && (
        <section className="space-y-2" aria-labelledby="wf-news">
          <h2 id="wf-news" className="text-base font-semibold">
            News and data
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {news.slice(0, 8).map((i, n) => (
              <li key={`${i.title}-${n}`} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="font-medium">{i.href ? <a href={i.href} target="_blank" rel="noreferrer" className="hover:underline">{i.title}</a> : i.title}</span>
                  {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{i.scope === 'national' ? 'National' : 'Your region'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
