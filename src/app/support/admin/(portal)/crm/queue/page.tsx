import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmDateCheckButton } from '@/components/admin/CrmDateCheckButton'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { QueueRowActions } from '@/components/admin/QueueRowActions'
import { formatDate, sinceLabel, qualityClass, PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import type { CrmPersonRole, CrmPriorityTier } from '@prisma/client'

export const maxDuration = 30

const DAY = 86_400_000
// Fetch a buffer beyond the display count so filtering out snoozed-and-still-
// stale rows in JS (see isSnoozedStale below) doesn't leave a band short.
const FETCH_BUFFER = 15

/** True once a row should stay hidden: snoozed, and nothing newer has come up since. */
function isSnoozedStale(queueSnoozedAt: Date | null, drivingAt: Date | null): boolean {
  if (!queueSnoozedAt) return false
  if (!drivingAt) return true
  return queueSnoozedAt >= drivingAt
}

// Same taxonomy and the same "fold into one bucket for free" trick as the
// People queue's categoryOf — see that file's comment. An org is bucketed
// by its single most urgent qualifying person, not listed once per category
// its various contacts happen to span.
function categoryOf(roles: CrmPersonRole[]): string {
  if (roles.length === 0) return 'Uncategorized'
  return PERSON_ROLE_LABELS[roles[0]].split(':')[0].trim()
}
const CATEGORY_ORDER = ['F', 'BD', 'NC', 'GTM', 'Uncategorized']
const CATEGORY_NAME: Record<string, string> = {
  F: 'Funding', BD: 'Business development', NC: 'Network & contacts', GTM: 'Go-to-market', Uncategorized: 'No contact type set',
}
const TIER_RANK: Record<CrmPriorityTier, number> = { P0: 0, P1: 1, P2: 2 }

// The morning page. Promises rank above reminders, and both rank above
// opportunity, because a broken commitment costs a relationship while a missed
// opportunity costs an opportunity.
export default async function CrmQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ p2?: string }>
}) {
  await requireAdmin()
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * DAY)
  const sp = await searchParams
  const includeP2 = sp.p2 === '1'
  const priorityTiers: CrmPriorityTier[] = includeP2 ? ['P0', 'P1', 'P2'] : ['P0', 'P1']

  const [promisedRaw, overdueStepsRaw, upcoming, pastDue, priorityOrgsRaw] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', committedFollowUpAt: { lt: now } },
      orderBy: { committedFollowUpAt: 'asc' },
      take: 15 + FETCH_BUFFER,
      select: {
        id: true, title: true, committedFollowUpAt: true, committedTo: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, stage: { select: { label: true } },
        org: {
          select: {
            id: true, name: true, queueSnoozedAt: true,
            outplacementProfile: { select: { headcountAffected: true, announcedAt: true } },
          },
        },
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', nextStepDueAt: { lt: now }, committedFollowUpAt: null },
      orderBy: [{ priorityScore: 'desc' }],
      take: 15 + FETCH_BUFFER,
      select: {
        id: true, title: true, nextStep: true, nextStepDueAt: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, stage: { select: { label: true } },
        org: {
          select: {
            id: true, name: true, queueSnoozedAt: true,
            outplacementProfile: { select: { headcountAffected: true, announcedAt: true } },
          },
        },
      },
    }),
    prisma.crmDeadline.findMany({
      where: { dueAt: { gte: now, lte: in60 } },
      orderBy: { dueAt: 'asc' },
      take: 15,
      select: { id: true, label: true, dueAt: true, sourceUrl: true, org: { select: { id: true, name: true, website: true } } },
    }),
    prisma.crmDeadline.findMany({
      where: { dueAt: { lt: now } },
      orderBy: { dueAt: 'desc' },
      take: 15,
      select: { id: true, label: true, dueAt: true, sourceUrl: true, org: { select: { id: true, name: true, website: true } } },
    }),
    // Mirrors the People queue's own priority-by-category grouping — see
    // that file's comment. An org qualifies here purely by having a P0/P1
    // (P2 optional) person on it; bucketed by that person's category, same
    // "fold CHROs into outplacement for free" effect the People queue gets.
    prisma.crmOrganization.findMany({
      where: { affiliations: { some: { person: { priority: { in: priorityTiers }, deletedAt: null } } } },
      take: 400,
      select: {
        id: true, name: true, queueSnoozedAt: true,
        outplacementProfile: { select: { headcountAffected: true, announcedAt: true } },
        affiliations: {
          where: { person: { priority: { in: priorityTiers }, deletedAt: null } },
          select: {
            person: {
              select: {
                id: true, fullName: true, priority: true, priorityScore: true, priorityOverride: true,
                leadQuality: true, roles: true, lastTouchedAt: true,
              },
            },
          },
        },
      },
    }),
  ])

  const promised = promisedRaw.filter((o) => !isSnoozedStale(o.org?.queueSnoozedAt ?? null, o.committedFollowUpAt)).slice(0, 15)
  const overdueSteps = overdueStepsRaw.filter((o) => !isSnoozedStale(o.org?.queueSnoozedAt ?? null, o.nextStepDueAt)).slice(0, 15)

  // For each qualifying org, its single most urgent person decides both the
  // org's category bucket and what the row displays — same "one home, not
  // one per matching category" simplification as the People queue.
  const priorityOrgs = priorityOrgsRaw
    .map((org) => {
      const bestPerson = [...org.affiliations.map((a) => a.person)]
        .sort((a, b) => TIER_RANK[a.priority as CrmPriorityTier] - TIER_RANK[b.priority as CrmPriorityTier]
          || (b.priorityOverride ?? b.priorityScore) - (a.priorityOverride ?? a.priorityScore))[0]
      return { org, bestPerson }
    })
    .filter((r) => r.bestPerson && !isSnoozedStale(r.org.queueSnoozedAt, r.bestPerson.lastTouchedAt))

  const priorityByCategory = new Map<string, typeof priorityOrgs>()
  for (const r of priorityOrgs) {
    const cat = categoryOf(r.bestPerson.roles)
    priorityByCategory.set(cat, [...(priorityByCategory.get(cat) ?? []), r])
  }
  const priorityCategories = CATEGORY_ORDER.filter((c) => (priorityByCategory.get(c)?.length ?? 0) > 0)

  const totalItems = promised.length + overdueSteps.length + upcoming.length + priorityOrgs.length

  function outplacementDetail(org: { outplacementProfile: { headcountAffected: number | null; announcedAt: Date | null } | null } | null): string | undefined {
    const p = org?.outplacementProfile
    if (!p || !p.headcountAffected) return undefined
    return `${p.headcountAffected.toLocaleString()} roles affected${p.announcedAt ? `, announced ${formatDate(p.announcedAt)}` : ''}`
  }

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · {totalItems} items
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/support/admin/crm/queue${includeP2 ? '' : '?p2=1'}`}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
          >
            {includeP2 ? 'Hide P2' : 'Include P2'}
          </Link>
          <Link href="/support/admin/crm/queue/people" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">People queue</Link>
          <Link href="/support/admin/crm/dates" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All dates</Link>
          <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All leads</Link>
        </nav>
      </header>

      {totalItems === 0 && pastDue.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing needs you this morning.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No promises outstanding, no deadlines inside 60 days, and no org with a P0/P1{includeP2 ? '/P2' : ''} person.
          </p>
        </div>
      )}

      <Band
        tone="critical"
        title="Promised — you gave someone a date"
        blurb="These outrank everything else on the page."
        count={promised.length}
        empty="No outstanding promises."
      >
        {promised.map((o) => (
          <Row
            key={o.id}
            orgId={o.org?.id}
            opportunityId={o.id}
            title={o.org?.name ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={`${o.pipeline.label} · ${o.stage.label}`}
            chip={`${Math.floor((now.getTime() - (o.committedFollowUpAt?.getTime() ?? 0)) / DAY)}d past promise`}
            chipTone="critical"
            detail={outplacementDetail(o.org) ?? (o.committedTo ? `“${o.committedTo}”` : `Promised by ${formatDate(o.committedFollowUpAt)}`)}
          />
        ))}
      </Band>

      <Band
        tone="warning"
        title="Overdue — your own next step"
        blurb="A reminder you set yourself and the date has passed."
        count={overdueSteps.length}
        empty="No overdue next steps."
      >
        {overdueSteps.map((o) => (
          <Row
            key={o.id}
            orgId={o.org?.id}
            opportunityId={o.id}
            title={o.org?.name ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={`${o.pipeline.label} · ${o.stage.label}`}
            chip={`due ${formatDate(o.nextStepDueAt)}`}
            chipTone="warning"
            detail={outplacementDetail(o.org) ?? o.nextStep ?? undefined}
          />
        ))}
      </Band>

      <Band
        tone="warning"
        title="Deadline radar — next 60 days"
        blurb="Only real dates appear here. Most funding rows are genuinely rolling and have none."
        count={upcoming.length}
        empty="No dated deadlines inside 60 days."
      >
        {upcoming.map((d) => (
          <Row
            key={d.id}
            orgId={d.org?.id}
            title={d.org?.name ?? d.label}
            score={null}
            meta={d.label}
            chip={formatDate(d.dueAt)}
            chipTone="warning"
            detail={`${Math.ceil(((d.dueAt?.getTime() ?? 0) - now.getTime()) / DAY)} days away`}
          />
        ))}
      </Band>

      {priorityCategories.map((cat) => {
        const orgs = priorityByCategory.get(cat) ?? []
        return (
          <Band
            key={cat}
            tone="good"
            title={`${CATEGORY_NAME[cat] ?? cat} — ${includeP2 ? 'P0/P1/P2' : 'P0/P1'} contact on file`}
            blurb="Mirrors the People queue's own grouping — an org shows up here because someone there does."
            count={orgs.length}
            empty="Nothing here."
          >
            {orgs.map(({ org, bestPerson }) => (
              <Row
                key={org.id}
                orgId={org.id}
                title={org.name}
                quality={bestPerson.leadQuality}
                score={bestPerson.priorityOverride ?? bestPerson.priorityScore}
                meta={`${bestPerson.priority} · ${bestPerson.fullName}`}
                chip={bestPerson.lastTouchedAt ? `last touch ${sinceLabel(bestPerson.lastTouchedAt)}` : 'never contacted'}
                chipTone={bestPerson.lastTouchedAt ? 'muted' : 'good'}
                detail={outplacementDetail(org)}
              />
            ))}
          </Band>
        )
      })}

      {pastDue.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Dates that have passed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Still open, but the date on file is behind us. Checking fetches the source page and offers what it
            finds — it never writes a date for you.
          </p>
          <ul className="mt-3 space-y-2">
            {pastDue.map((d) => (
              <li key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {d.org ? (
                      <Link href={`/support/admin/crm/organizations/${d.org.id}`} className="hover:underline">{d.org.name}</Link>
                    ) : d.label}
                    <span className="ml-2 font-normal text-muted-foreground">{d.label}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">was {formatDate(d.dueAt)}</span>
                </div>
                <div className="mt-2">
                  <CrmDateCheckButton deadlineId={d.id} hasSource={Boolean(d.sourceUrl ?? d.org?.website)} sourceUrl={d.sourceUrl ?? d.org?.website} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const TONE = {
  critical: 'border-destructive/50',
  warning: 'border-orange/50',
  good: 'border-brand/50',
  muted: 'border-border',
} as const

function Band({
  tone, title, blurb, count, empty, children,
}: {
  tone: keyof typeof TONE
  title: string
  blurb: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 text-lg font-semibold">
        <span className={`inline-block h-2.5 w-2.5 rounded-sm border-4 ${TONE[tone]}`} aria-hidden />
        {title}
        <span className="text-sm font-normal text-muted-foreground">{count}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      {count === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">{children}</ul>
      )}
    </section>
  )
}

const CHIP = {
  critical: 'bg-destructive/10 text-destructive',
  warning: 'bg-orange/15 text-orange',
  good: 'bg-brand/15 text-brand',
  muted: 'bg-muted text-muted-foreground',
} as const

function Row({
  orgId, opportunityId, title, quality, score, meta, chip, chipTone, detail,
}: {
  orgId?: string
  opportunityId?: string
  title: string
  quality?: string
  score: number | null
  meta: string
  chip: string
  chipTone: keyof typeof CHIP
  detail?: string
}) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {orgId ? (
            <CrmPeekButton id={orgId} kind="org" className="text-sm font-medium hover:underline">{title}</CrmPeekButton>
          ) : (
            <span className="text-sm font-medium">{title}</span>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{meta}</span>
            {quality && quality !== 'UNGRADED' && (
              <span className={`rounded px-1 py-0.5 font-semibold ${qualityClass(quality as 'A')}`}>{quality}</span>
            )}
          </p>
          {detail && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[chipTone]}`}>{chip}</span>
          {score !== null && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{Math.round(score)}</span>
          )}
          <QueueRowActions orgId={orgId} opportunityId={opportunityId} />
        </div>
      </div>
    </li>
  )
}
