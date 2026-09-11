import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmDateCheckButton } from '@/components/admin/CrmDateCheckButton'
import { formatDate, sinceLabel, qualityClass } from '@/lib/crm/labels'

export const maxDuration = 30

const DAY = 86_400_000

// The morning page. Promises rank above reminders, and both rank above
// opportunity, because a broken commitment costs a relationship while a missed
// opportunity costs an opportunity.
export default async function CrmQueuePage() {
  await requireAdmin()
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * DAY)

  const [promised, overdueSteps, upcoming, pastDue, neverTouched] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', committedFollowUpAt: { lt: now } },
      orderBy: { committedFollowUpAt: 'asc' },
      select: {
        id: true, title: true, committedFollowUpAt: true, committedTo: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, org: { select: { id: true, name: true } },
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', nextStepDueAt: { lt: now }, committedFollowUpAt: null },
      orderBy: [{ priorityScore: 'desc' }],
      take: 15,
      select: {
        id: true, title: true, nextStep: true, nextStepDueAt: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, org: { select: { id: true, name: true } },
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
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', activities: { none: {} }, leadQuality: { in: ['A', 'B'] } },
      orderBy: { priorityScore: 'desc' },
      take: 12,
      select: {
        id: true, title: true, priorityScore: true, priorityOverride: true, leadQuality: true,
        nextStep: true, createdAt: true,
        pipeline: { select: { label: true } },
        org: {
          select: {
            id: true, name: true,
            affiliations: { take: 3, select: { person: { select: { id: true, fullName: true, connectedAt: true } } } },
          },
        },
      },
    }),
  ])

  const totalItems = promised.length + overdueSteps.length + upcoming.length + neverTouched.length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · {totalItems} items
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/support/admin/crm/dates" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All dates</Link>
          <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All leads</Link>
        </nav>
      </header>

      {totalItems === 0 && pastDue.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing needs you this morning.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No promises outstanding, no deadlines inside 60 days, and every A and B lead has been contacted.
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
            href={o.org ? `/support/admin/crm/organizations/${o.org.id}` : '/support/admin/crm/leads'}
            title={o.org?.name ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={o.pipeline.label}
            chip={`${Math.floor((now.getTime() - (o.committedFollowUpAt?.getTime() ?? 0)) / DAY)}d past promise`}
            chipTone="critical"
            detail={o.committedTo ? `“${o.committedTo}”` : `Promised by ${formatDate(o.committedFollowUpAt)}`}
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
            href={o.org ? `/support/admin/crm/organizations/${o.org.id}` : '/support/admin/crm/leads'}
            title={o.org?.name ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={o.pipeline.label}
            chip={`due ${formatDate(o.nextStepDueAt)}`}
            chipTone="warning"
            detail={o.nextStep ?? undefined}
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
            href={d.org ? `/support/admin/crm/organizations/${d.org.id}` : '/support/admin/crm/dates'}
            title={d.org?.name ?? d.label}
            score={null}
            meta={d.label}
            chip={formatDate(d.dueAt)}
            chipTone="warning"
            detail={`${Math.ceil(((d.dueAt?.getTime() ?? 0) - now.getTime()) / DAY)} days away`}
          />
        ))}
      </Band>

      <Band
        tone="good"
        title="Next best actions — high fit, never contacted"
        blurb="A and B grades with nothing logged against them. This is the band your spreadsheets could not produce."
        count={neverTouched.length}
        empty="Every A and B lead has been contacted at least once."
      >
        {neverTouched.map((o) => {
          const warm = o.org?.affiliations.filter((a) => a.person.connectedAt) ?? []
          return (
            <Row
              key={o.id}
              href={o.org ? `/support/admin/crm/organizations/${o.org.id}` : '/support/admin/crm/leads'}
              title={o.org?.name ?? o.title}
              quality={o.leadQuality}
              score={o.priorityOverride ?? o.priorityScore}
              meta={o.pipeline.label}
              chip={warm.length > 0 ? `${warm.length} warm ${warm.length === 1 ? 'path' : 'paths'}` : `added ${sinceLabel(o.createdAt)}`}
              chipTone={warm.length > 0 ? 'good' : 'muted'}
              detail={
                warm.length > 0
                  ? `Via ${warm.map((a) => a.person.fullName).join(', ')}`
                  : (o.nextStep ?? undefined)
              }
            />
          )
        })}
      </Band>

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
  href, title, quality, score, meta, chip, chipTone, detail,
}: {
  href: string
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
          <Link href={href} className="text-sm font-medium hover:underline">{title}</Link>
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
        </div>
      </div>
    </li>
  )
}
