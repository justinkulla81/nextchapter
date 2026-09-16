import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { QueueRowActions } from '@/components/admin/QueueRowActions'
import { formatDate, sinceLabel, qualityClass } from '@/lib/crm/labels'

export const maxDuration = 30

const DAY = 86_400_000
const FETCH_BUFFER = 15

function isSnoozedStale(queueSnoozedAt: Date | null, drivingAt: Date | null): boolean {
  if (!queueSnoozedAt) return false
  if (!drivingAt) return true
  return queueSnoozedAt >= drivingAt
}

/**
 * Same shape as the org queue, but every row is a person — independently
 * dismissible from it (see CrmPerson.queueSnoozedAt's schema comment).
 * A company you've stopped chasing today can still have a person worth
 * following up with, so this never reuses the org queue's snooze state.
 */
export default async function CrmPeopleQueuePage() {
  await requireAdmin()
  const now = new Date()

  const [promisedRaw, overdueStepsRaw, chroRaw, neverTouchedRaw] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', committedFollowUpAt: { lt: now }, primaryPersonId: { not: null }, primaryPerson: { deletedAt: null } },
      orderBy: { committedFollowUpAt: 'asc' },
      take: 15 + FETCH_BUFFER,
      select: {
        id: true, title: true, committedFollowUpAt: true, committedTo: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, stage: { select: { label: true } },
        primaryPerson: { select: { id: true, fullName: true, queueSnoozedAt: true } },
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', nextStepDueAt: { lt: now }, committedFollowUpAt: null, primaryPersonId: { not: null }, primaryPerson: { deletedAt: null } },
      orderBy: [{ priorityScore: 'desc' }],
      take: 15 + FETCH_BUFFER,
      select: {
        id: true, title: true, nextStep: true, nextStepDueAt: true, priorityScore: true,
        priorityOverride: true, leadQuality: true,
        pipeline: { select: { label: true } }, stage: { select: { label: true } },
        primaryPerson: { select: { id: true, fullName: true, queueSnoozedAt: true } },
      },
    }),
    // CHROs tracked down from a layoff notice's company — a lead source of
    // its own (see Company.chroName / updateCompanyChroContact), most
    // valuable the moment they're captured and untouched.
    prisma.crmPerson.findMany({
      where: { roles: { has: 'HIRING_MANAGER' }, activities: { none: {} }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 12 + FETCH_BUFFER,
      select: {
        id: true, fullName: true, email: true, createdAt: true, queueSnoozedAt: true,
        affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
      },
    }),
    prisma.crmPerson.findMany({
      // CHRO_HR people have their own band above — excluded again here
      // rather than relying only on the JS filter below, so the fetch
      // buffer isn't spent on rows that will just get dropped.
      where: { activities: { none: {} }, leadQuality: { in: ['A', 'B'] }, NOT: { roles: { has: 'HIRING_MANAGER' } }, deletedAt: null },
      orderBy: { priorityScore: 'desc' },
      take: 12 + FETCH_BUFFER,
      select: {
        id: true, fullName: true, priorityScore: true, priorityOverride: true, leadQuality: true,
        createdAt: true, queueSnoozedAt: true,
        affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
      },
    }),
  ])

  const promised = promisedRaw.filter((o) => !isSnoozedStale(o.primaryPerson?.queueSnoozedAt ?? null, o.committedFollowUpAt)).slice(0, 15)
  const overdueSteps = overdueStepsRaw.filter((o) => !isSnoozedStale(o.primaryPerson?.queueSnoozedAt ?? null, o.nextStepDueAt)).slice(0, 15)
  const chroContacts = chroRaw.filter((p) => !isSnoozedStale(p.queueSnoozedAt, p.createdAt)).slice(0, 12)
  const neverTouched = neverTouchedRaw.filter((p) => !isSnoozedStale(p.queueSnoozedAt, p.createdAt)).slice(0, 12)

  const totalItems = promised.length + overdueSteps.length + chroContacts.length + neverTouched.length

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">People queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · {totalItems} items ·
            same idea as the org queue, but every row is a person, and dismissing one never touches the company queue.
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Org queue</Link>
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All people</Link>
        </nav>
      </header>

      {totalItems === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing needs you this morning.</p>
        </div>
      )}

      <Band
        tone="critical"
        title="Promised — you gave someone a date"
        count={promised.length}
        empty="No outstanding promises."
      >
        {promised.map((o) => (
          <Row
            key={o.id}
            personId={o.primaryPerson?.id}
            title={o.primaryPerson?.fullName ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={`${o.pipeline.label} · ${o.stage.label}`}
            chip={`${Math.floor((now.getTime() - (o.committedFollowUpAt?.getTime() ?? 0)) / DAY)}d past promise`}
            chipTone="critical"
            detail={o.committedTo ? `“${o.committedTo}”` : `Promised by ${formatDate(o.committedFollowUpAt)}`}
          />
        ))}
      </Band>

      <Band
        tone="warning"
        title="Overdue — your own next step"
        count={overdueSteps.length}
        empty="No overdue next steps."
      >
        {overdueSteps.map((o) => (
          <Row
            key={o.id}
            personId={o.primaryPerson?.id}
            title={o.primaryPerson?.fullName ?? o.title}
            quality={o.leadQuality}
            score={o.priorityOverride ?? o.priorityScore}
            meta={`${o.pipeline.label} · ${o.stage.label}`}
            chip={`due ${formatDate(o.nextStepDueAt)}`}
            chipTone="warning"
            detail={o.nextStep ?? undefined}
          />
        ))}
      </Band>

      <Band
        tone="good"
        title="CHROs from layoff notices — not yet contacted"
        count={chroContacts.length}
        empty="No untouched CHRO contacts on file."
      >
        {chroContacts.map((p) => (
          <Row
            key={p.id}
            personId={p.id}
            title={p.fullName}
            score={null}
            meta={p.affiliations[0]?.org.name ?? 'Company not linked'}
            chip={`added ${sinceLabel(p.createdAt)}`}
            chipTone="good"
            detail={p.email ?? undefined}
          />
        ))}
      </Band>

      <Band
        tone="good"
        title="Next best actions — high fit, never contacted"
        count={neverTouched.length}
        empty="Every A and B person has been contacted at least once."
      >
        {neverTouched.map((p) => (
          <Row
            key={p.id}
            personId={p.id}
            title={p.fullName}
            quality={p.leadQuality}
            score={p.priorityOverride ?? p.priorityScore}
            meta={p.affiliations[0]?.org.name ?? '—'}
            chip={`added ${sinceLabel(p.createdAt)}`}
            chipTone="muted"
          />
        ))}
      </Band>
    </div>
  )
}

const TONE = { critical: 'border-destructive/50', warning: 'border-orange/50', good: 'border-brand/50', muted: 'border-border' } as const

function Band({ tone, title, count, empty, children }: { tone: keyof typeof TONE; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 text-lg font-semibold">
        <span className={`inline-block h-2.5 w-2.5 rounded-sm border-4 ${TONE[tone]}`} aria-hidden />
        {title}
        <span className="text-sm font-normal text-muted-foreground">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">{children}</ul>
      )}
    </section>
  )
}

const CHIP = { critical: 'bg-destructive/10 text-destructive', warning: 'bg-orange/15 text-orange', good: 'bg-brand/15 text-brand', muted: 'bg-muted text-muted-foreground' } as const

function Row({
  personId, title, quality, score, meta, chip, chipTone, detail,
}: {
  personId?: string
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
          {personId ? (
            <CrmPeekButton id={personId} kind="person" className="text-sm font-medium hover:underline">{title}</CrmPeekButton>
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
          <QueueRowActions personId={personId} />
        </div>
      </div>
    </li>
  )
}
