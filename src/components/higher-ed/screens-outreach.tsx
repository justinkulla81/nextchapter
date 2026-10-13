// Release 2 screens: outreach that runs itself, with staff approving each
// send. Layoff alerts, check-ins, the outreach log, engagement, and the
// "Waiting for you" card on each office's home. Roster names and campaign
// data are the college's own; anything from the candidate side (engagement)
// comes through the consent views.

import Link from 'next/link'
import type { CheckInKind } from '@prisma/client'
import { ArrowRight, BarChart3, ClipboardCheck, Mail, ShieldAlert } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { engagementOverview } from '@/lib/higher-ed/engagement'
import { waitingFor } from '@/lib/higher-ed/inbox'
import { CHECKIN_ANSWERS, CHECKIN_KIND_LABELS, checkInOverview, pendingCheckIns } from '@/lib/higher-ed/checkins'
import { checkInMonthFrom, serviceSettingsFrom } from '@/lib/higher-ed/services'
import { approveCheckIns } from '@/app/i/[slug]/(portal)/outreach-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { ConfirmActionButton } from './ConfirmActionButton'
import { LayoffInbox, type LayoffGroup } from './LayoffInbox'

type Props = { ctx: WorkspaceContext; base: string }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : null)
const name = (m: { firstName: string | null; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unnamed'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const EARLY: CheckInKind[] = ['M6', 'M18', 'M24']
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')

// ── Waiting for you ─────────────────────────────────────────────────────────

export async function WaitingForYou({ ctx, office, base }: Props & { office: 'alumni' | 'career' }) {
  const items = await waitingFor(ctx.institution.id, office, base)
  return (
    <section aria-labelledby="waiting" className="rounded-lg border border-border bg-card p-4">
      <h2 id="waiting" className="text-base font-semibold">
        Waiting for you
      </h2>
      {items.length ? (
        <ul className="mt-2 divide-y divide-border">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary">
                {i.text}
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Nothing right now. New layoff matches and check-ins show up here, and in your weekly email.</p>
      )}
    </section>
  )
}

// ── Alumni Relations › Layoff alerts ────────────────────────────────────────

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(new Date().getTime() - n * DAY)

export async function AlumniLayoffs({ ctx }: Props) {
  const id = ctx.institution.id
  const [fresh, recent] = await Promise.all([
    prisma.layoffMatch.findMany({
      where: { institutionId: id, outreachStatus: 'NEW' },
      select: {
        id: true,
        member: { select: { firstName: true, lastName: true, classYear: true } },
        warnNotice: { select: { id: true, employer: true, county: true, state: true, noticeDate: true, employees: true, sourceUrl: true } },
      },
      orderBy: [{ matchedAt: 'desc' }],
    }),
    prisma.layoffMatch.findMany({
      where: { institutionId: id, outreachStatus: 'SENT', updatedAt: { gte: daysAgo(90) } },
      select: { id: true, warnNotice: { select: { employer: true } }, outreachSend: { select: { sentAt: true, clickedAt: true, claimedAt: true } } },
    }),
  ])
  const groups = new Map<string, LayoffGroup>()
  for (const m of fresh) {
    const n = m.warnNotice
    const g = groups.get(n.id) ?? {
      noticeId: n.id,
      employer: n.employer,
      where: [n.county, n.state].filter(Boolean).join(', ') || null,
      noticeDate: fmt(n.noticeDate),
      employees: n.employees,
      sourceUrl: n.sourceUrl,
      matches: [],
    }
    g.matches.push({ id: m.id, name: name(m.member), classYear: m.member.classYear })
    groups.set(n.id, g)
  }
  const clicked = recent.filter((r) => r.outreachSend?.clickedAt || r.outreachSend?.claimedAt).length

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every night we check state WARN layoff notices against where your alumni work. A match doesn&apos;t mean someone was laid off; the email says
        &ldquo;if you&apos;re affected, {ctx.institution.name} has your back&rdquo;, and only the alum can say they were.
      </p>
      {groups.size ? (
        <LayoffInbox slug={ctx.institution.slug} groups={[...groups.values()]} isDemo={ctx.institution.isDemo} readOnly={ctx.readOnly} />
      ) : (
        <EmptyState icon={ShieldAlert} title="No new layoff matches" description="When a notice names a company where your alumni work, they'll show up here, grouped by notice." />
      )}
      {recent.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Layoff emails, last 90 days" value={recent.length.toLocaleString()} />
          <StatTile label="Opened the link" value={pct(clicked, recent.length)} note={`${clicked} of ${recent.length}`} />
        </div>
      )}
    </div>
  )
}

// ── Alumni Relations › Outreach ─────────────────────────────────────────────

const CAMPAIGN_LABELS: Record<string, string> = {
  LAYOFF: 'Layoff alert',
  WELCOME: 'Join invitation',
  CHECK_IN: 'Check-in',
  GRATITUDE: 'Thank-you',
  MENTOR_INVITE: 'Mentor invitation',
  CUSTOM: 'Custom',
}

export async function AlumniOutreach({ ctx }: Props) {
  const id = ctx.institution.id
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { enabledFeatures: true } })
  const annualOn = serviceSettingsFrom(inst.enabledFeatures).annual_checkin?.on
  const [pending, campaigns] = await Promise.all([
    pendingCheckIns(id),
    prisma.outreachCampaign.findMany({
      where: { institutionId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, type: true, subject: true, sentAt: true, createdAt: true, _count: { select: { sends: true } } },
    }),
  ])
  const stats = campaigns.length
    ? await prisma.outreachSend.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaigns.map((c) => c.id) } },
        _count: { clickedAt: true, claimedAt: true },
      })
    : []
  const annual = pending.find((p) => p.kind === 'CUSTOM')?.count ?? 0

  return (
    <div className="space-y-6">
      <section aria-labelledby="annual" className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h2 id="annual" className="text-base font-semibold">
          Annual check-in
        </h2>
        <p className="text-sm text-muted-foreground">
          {annualOn
            ? `Every ${MONTHS[checkInMonthFrom(inst.enabledFeatures) - 1]}, each alum gets one email: "Has anything changed?" with four one-click answers. Anyone who's looking or was laid off goes to Career Services. Change the month in Admin › Services.`
            : 'Turned off. Turn on "Annual career check-in" in Admin › Services.'}
        </p>
        {annual > 0 && !ctx.readOnly && (
          <ConfirmActionButton
            label={`Send ${annual.toLocaleString()} annual check-ins`}
            confirm={
              ctx.institution.isDemo
                ? `Record ${annual.toLocaleString()} check-ins? Nothing is emailed on a demo.`
                : `Email ${annual.toLocaleString()} alumni the annual check-in from ${ctx.institution.name}? It can't be unsent.`
            }
            confirmLabel={ctx.institution.isDemo ? 'Record check-ins' : 'Send check-ins'}
            run={approveCheckIns.bind(null, ctx.institution.slug, 'alumni')}
          />
        )}
      </section>

      <section aria-labelledby="log" className="space-y-2">
        <h2 id="log" className="text-base font-semibold">
          Sent
        </h2>
        {campaigns.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Outreach sent</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {['Sent', 'Type', 'Subject', 'Recipients', 'Clicked', 'Joined'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => {
                  const s = stats.find((x) => x.campaignId === c.id)
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmt(c.sentAt ?? c.createdAt)}</td>
                      <td className="px-4 py-2">{CAMPAIGN_LABELS[c.type] ?? c.type}</td>
                      <td className="px-4 py-2">{c.subject.replace(/\{\{\w+\}\}/g, '…')}</td>
                      <td className="px-4 py-2 tabular-nums">{c._count.sends.toLocaleString()}</td>
                      <td className="px-4 py-2 tabular-nums">{pct(s?._count.clickedAt ?? 0, c._count.sends)}</td>
                      <td className="px-4 py-2 tabular-nums">{(s?._count.claimedAt ?? 0).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Mail} title="Nothing sent yet" description="Join invitations, layoff emails and check-ins show up here with clicks and joins." />
        )}
        {ctx.institution.isDemo && <p className="text-xs text-muted-foreground">Demo college: sends are recorded here, never emailed.</p>}
      </section>
    </div>
  )
}

// ── Alumni Relations › Engagement ───────────────────────────────────────────

export async function AlumniEngagement({ ctx }: Props) {
  const o = await engagementOverview(ctx.institution.id)
  const total = o.tiers.reduce((n, t) => n + t.members, 0)
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        A score from the last 12 months: logins, using the tools, coaching, mentor calls, opening your emails, sharing a milestone, and gifts. Grouped by
        CASE&apos;s four engagement categories so it drops straight into your annual report. Only alumni who share their engagement count; it updates nightly.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {o.tiers.map((t) => (
          <StatTile key={t.tier} label={`${t.tier} engagement`} value={t.members.toLocaleString()} note={total ? pct(t.members, total) : undefined} />
        ))}
      </div>
      {o.byDecade.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Engagement points by class decade and CASE category</caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                {['Class of', 'Alumni', 'Volunteer', 'Experiential', 'Philanthropic', 'Communication'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.byDecade.map((d) => (
                <tr key={d.decade}>
                  <td className="px-4 py-2">{d.decade}</td>
                  <td className="px-4 py-2 tabular-nums">{d.members.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums">{d.volunteer.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums">{d.experiential.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums">{d.philanthropic.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums">{d.communication.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={BarChart3} title="No engagement yet" description="Scores start once alumni join and use NextChapter, or once you import gifts." />
      )}
    </div>
  )
}

// ── Career Services › Check-ins ─────────────────────────────────────────────

export async function CareerCheckIns({ ctx }: Props) {
  const id = ctx.institution.id
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { enabledFeatures: true } })
  const on = serviceSettingsFrom(inst.enabledFeatures).grad_checkins?.on
  const [{ byKind, followUps }, pending] = await Promise.all([checkInOverview(id), pendingCheckIns(id)])
  const ready = pending.filter((p) => EARLY.includes(p.kind)).reduce((n, p) => n + p.count, 0)
  const answerLabel = (a: string) => CHECKIN_ANSWERS.find((x) => x.key === a)?.label ?? a

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        {on
          ? 'Recent grads get "Has anything changed?" 6, 18 and 24 months after graduation. Anyone starting to look or laid off lands below for a follow-up, and is treated as in transition (no fundraising asks).'
          : 'Early-career check-ins are off. Turn on "Early-career check-ins" in Admin › Services.'}
      </p>
      {ready > 0 && !ctx.readOnly && (
        <ConfirmActionButton
          label={`Send ${ready} check-ins`}
          confirm={
            ctx.institution.isDemo
              ? `Record ${ready} check-ins? Nothing is emailed on a demo.`
              : `Email ${ready} recent grads the check-in from ${ctx.institution.name}? It can't be unsent.`
          }
          confirmLabel={ctx.institution.isDemo ? 'Record check-ins' : 'Send check-ins'}
          run={approveCheckIns.bind(null, ctx.institution.slug, 'career')}
        />
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {byKind.map((k) => (
          <StatTile key={k.kind} label={CHECKIN_KIND_LABELS[k.kind]} value={pct(k.responded, k.sent)} note={`${k.responded} of ${k.sent} answered${k.scheduled ? ` · ${k.scheduled} waiting` : ''}`} />
        ))}
      </div>
      <section aria-labelledby="followups" className="space-y-2">
        <h2 id="followups" className="text-base font-semibold">
          Follow up
        </h2>
        {followUps.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Alumni who asked for help in a check-in</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {['Name', 'Class', 'Check-in', 'Answer', 'Answered', 'Email'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {followUps.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2">{name(f.member)}</td>
                    <td className="px-4 py-2">{f.member.classYear ?? '—'}</td>
                    <td className="px-4 py-2">{CHECKIN_KIND_LABELS[f.kind]}</td>
                    <td className="px-4 py-2">{answerLabel(f.answer)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmt(f.respondedAt)}</td>
                    <td className="px-4 py-2">
                      <a href={`mailto:${f.member.email}`} className="text-primary hover:underline">
                        {f.member.email}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No one waiting" description="Alumni who answer “starting to look” or “laid off” show up here." />
        )}
      </section>
    </div>
  )
}
