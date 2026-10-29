import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { QueueRowActions } from '@/components/admin/QueueRowActions'
import { sinceLabel, qualityClass, PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import { followUpKind, parseFollowUpFilter, matchesFollowUpFilter, FOLLOW_UP_FILTERS, type FollowUpKind } from '@/lib/crm/followup-kind'
import type { CrmPersonRole, CrmPriorityTier } from '@prisma/client'

export const maxDuration = 30

const DAY = 86_400_000
const FETCH_BUFFER = 15

function isSnoozedStale(queueSnoozedAt: Date | null, drivingAt: Date | null): boolean {
  if (!queueSnoozedAt) return false
  if (!drivingAt) return true
  return queueSnoozedAt >= drivingAt
}

/**
 * The prefix before the ":" in PERSON_ROLE_LABELS ("BD: Hiring Manager" ->
 * "BD") — the same F:/BD:/NC:/GTM: taxonomy every other contact-type list in
 * the CRM already groups by, reused here instead of inventing a second
 * category system. This is also what folds CHROs into the outplacement
 * category "for free": HIRING_MANAGER and OUTPLACEMENT_BUYER both already
 * carry the "BD:" prefix, so a former standalone "CHROs" band and a real
 * outplacement contact land in the same bucket without any special-casing.
 */
function categoryOf(roles: CrmPersonRole[]): string {
  if (roles.length === 0) return 'Uncategorized'
  return PERSON_ROLE_LABELS[roles[0]].split(':')[0].trim()
}

const CATEGORY_ORDER = ['F', 'BD', 'NC', 'GTM', 'Uncategorized']
const CATEGORY_NAME: Record<string, string> = {
  F: 'Funding', BD: 'Business development', NC: 'Network & contacts', GTM: 'Go-to-market', Uncategorized: 'No contact type set',
}

/**
 * Same shape as the org queue, but every row is a person — independently
 * dismissible from it (see CrmPerson.queueSnoozedAt's schema comment).
 * A company you've stopped chasing today can still have a person worth
 * following up with, so this never reuses the org queue's snooze state.
 *
 * Redesigned around "what actually deserves my morning": every P0/P1 (P2
 * optional, since at 3,600+ people most rows are P2 and showing them all by
 * default would bury the two priority tiers that matter), grouped by
 * category rather than by how the lead was sourced — the CHRO band this
 * replaced was one lead SOURCE (layoff notices) getting its own permanent
 * section regardless of actual priority, which is exactly the inversion
 * this page exists to avoid on the org side already.
 */
export default async function CrmPeopleQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ p2?: string; f?: string }>
}) {
  await requireAdmin()
  const now = new Date()
  const sp = await searchParams
  const includeP2 = sp.p2 === '1'
  const filter = parseFollowUpFilter(sp.f)
  const priorityTiers: CrmPriorityTier[] = includeP2 ? ['P0', 'P1', 'P2'] : ['P0', 'P1']

  const [followUpPeopleRaw, promisedOppsRaw, priorityPeopleRaw] = await Promise.all([
    // A follow-up can be flagged with no specific date (see CrmInlineFollowUp) —
    // only the dated ones sort meaningfully into "upcoming", so undated ones
    // get their own short list instead of sorting arbitrarily among these.
    prisma.crmPerson.findMany({
      where: { nextFollowUpAt: { not: null }, deletedAt: null },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 15 + FETCH_BUFFER,
      select: { id: true, fullName: true, email: true, guessedEmail: true, nextFollowUpAt: true, nextFollowUpNote: true, queueSnoozedAt: true, affiliations: { orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1, select: { org: { select: { id: true, name: true } } } } },
    }),
    // A promise made TO someone outranks an internal reminder — see
    // scoring.ts's own comment on committedFollowUpAt vs nextStepDueAt.
    // Folded into the same "upcoming follow-ups" list rather than kept as
    // its own band, since both answer the same question: who did I say
    // I'd get back to, and when.
    prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', committedFollowUpAt: { not: null }, primaryPersonId: { not: null }, primaryPerson: { deletedAt: null } },
      orderBy: { committedFollowUpAt: 'asc' },
      take: 15 + FETCH_BUFFER,
      select: {
        id: true, committedFollowUpAt: true, committedTo: true,
        primaryPerson: { select: { id: true, fullName: true, queueSnoozedAt: true, affiliations: { orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1, select: { org: { select: { id: true, name: true } } } } } },
      },
    }),
    prisma.crmPerson.findMany({
      where: { priority: { in: priorityTiers }, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { priorityScore: 'desc' }],
      take: 400,
      select: {
        id: true, fullName: true, priority: true, priorityScore: true, priorityOverride: true,
        leadQuality: true, roles: true, lastTouchedAt: true, queueSnoozedAt: true, createdAt: true,
        affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
      },
    }),
  ])

  const followUpPeople = followUpPeopleRaw.filter((p) => !isSnoozedStale(p.queueSnoozedAt, p.nextFollowUpAt))
  const promisedOpps = promisedOppsRaw.filter((o) => !isSnoozedStale(o.primaryPerson?.queueSnoozedAt ?? null, o.committedFollowUpAt))

  type FollowUpRow = { key: string; personId?: string; title: string; date: Date; detail?: string; kind: 'promise' | 'follow-up'; auto: FollowUpKind; company?: { id: string; name: string }; emailable: boolean }
  const followUps: FollowUpRow[] = [
    ...promisedOpps.map((o): FollowUpRow => ({
      key: `opp-${o.id}`, personId: o.primaryPerson?.id, title: o.primaryPerson?.fullName ?? 'Unknown',
      date: o.committedFollowUpAt!, detail: o.committedTo ? `“${o.committedTo}”` : undefined, kind: 'promise',
      auto: followUpKind(null), company: o.primaryPerson?.affiliations[0]?.org, emailable: false,
    })),
    ...followUpPeople.map((p): FollowUpRow => ({
      key: `person-${p.id}`, personId: p.id, title: p.fullName,
      date: p.nextFollowUpAt!, detail: p.nextFollowUpNote ?? undefined, kind: 'follow-up',
      auto: followUpKind(p.nextFollowUpNote), company: p.affiliations[0]?.org, emailable: !!(p.email ?? p.guessedEmail) && !!p.affiliations[0],
    })),
  ].filter((f) => matchesFollowUpFilter(f.auto, filter)).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 20)

  const priorityPeople = priorityPeopleRaw.filter((p) => !isSnoozedStale(p.queueSnoozedAt, p.lastTouchedAt ?? p.createdAt))
  const byCategory = new Map<string, typeof priorityPeople>()
  for (const p of priorityPeople) {
    const cat = categoryOf(p.roles)
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), p])
  }
  // The category bands are priority people, not follow-ups: they show only under All.
  const categories = filter === 'all' ? CATEGORY_ORDER.filter((c) => (byCategory.get(c)?.length ?? 0) > 0) : []

  const totalItems = followUps.length + (filter === 'all' ? priorityPeople.length : 0)

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">People follow-ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · {totalItems} items ·
            every P0/P1{includeP2 ? '/P2' : ''} contact, grouped by category, plus who you owe a follow-up.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/support/admin/crm/queue/people?${new URLSearchParams({ ...(includeP2 ? {} : { p2: '1' }), ...(filter === 'all' ? {} : { f: filter }) }).toString()}`}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
          >
            {includeP2 ? 'Hide P2' : 'Include P2'}
          </Link>
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Org queue</Link>
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">All people</Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Which follow-ups to show">
        <span className="text-xs text-muted-foreground">Show</span>
        <div className="flex overflow-hidden rounded-md border border-border">
          {FOLLOW_UP_FILTERS.map((o) => (
            <Link
              key={o.key}
              href={`/support/admin/crm/queue/people?${new URLSearchParams({ ...(includeP2 ? { p2: '1' } : {}), ...(o.key === 'all' ? {} : { f: o.key }) }).toString()}`}
              aria-current={filter === o.key ? 'true' : undefined}
              className={`border-r border-border px-3 py-1.5 last:border-r-0 ${filter === o.key ? 'bg-navy text-white' : 'hover:bg-muted'}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm" aria-label="What is waiting">
        <SummaryChip count={followUps.filter((f) => f.date < now).length} label="overdue" tone="critical" />
        <SummaryChip count={followUps.filter((f) => f.date >= now).length} label="coming up" tone="warning" />
        <SummaryChip count={priorityPeople.filter((p) => !p.lastTouchedAt).length} label="priority people never contacted" tone="good" />
      </div>

      {totalItems === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing needs you this morning.</p>
        </div>
      )}

      <Band
        tone="critical"
        title="Upcoming follow-ups — promises and dated check-ins"
        count={followUps.length}
        empty="Nothing you've promised a date on."
      >
        {followUps.map((f) => {
          const days = Math.floor((f.date.getTime() - now.getTime()) / DAY)
          const overdue = days < 0
          return (
            <Row
              key={f.key}
              personId={f.personId}
              title={f.title}
              score={null}
              meta={f.kind === 'promise' ? 'Promised' : 'Follow-up'}
              chip={overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`}
              chipTone={overdue ? 'critical' : 'warning'}
              detail={f.detail}
              auto={f.auto}
              company={f.company}
              emailHref={f.auto.type === 'layoffs' && f.emailable && f.personId ? `/support/admin/crm/people/${f.personId}/layoff-email` : undefined}
            />
          )
        })}
      </Band>

      {categories.map((cat) => {
        const people = byCategory.get(cat) ?? []
        return (
          <Band
            key={cat}
            tone="good"
            title={`${CATEGORY_NAME[cat] ?? cat} — ${includeP2 ? 'P0/P1/P2' : 'P0/P1'}`}
            count={people.length}
            empty="Nothing here."
          >
            {people.map((p) => (
              <Row
                key={p.id}
                personId={p.id}
                title={p.fullName}
                quality={p.leadQuality}
                score={p.priorityOverride ?? p.priorityScore}
                meta={`${p.priority} · ${p.affiliations[0]?.org.name ?? 'No org on file'}`}
                chip={p.lastTouchedAt ? `last touch ${sinceLabel(p.lastTouchedAt)}` : 'never contacted'}
                chipTone={p.lastTouchedAt ? 'muted' : 'good'}
              />
            ))}
          </Band>
        )
      })}
    </div>
  )
}

const TONE = { critical: 'border-destructive/50', warning: 'border-orange/50', good: 'border-brand/50', muted: 'border-border' } as const

function Band({ tone, title, count, empty, children }: { tone: keyof typeof TONE; title: string; count: number; empty: string; children: React.ReactNode }) {
  // Nothing in it: one quiet line, so the bands with real work stay in view.
  if (count === 0) {
    return (
      <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
        <span className={`inline-block h-2 w-2 rounded-sm border-2 ${TONE[tone]}`} aria-hidden />
        <span className="font-medium text-foreground">{title}</span> · {empty}
      </p>
    )
  }
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
  personId, title, quality, score, meta, chip, chipTone, detail, auto, company, emailHref,
}: {
  personId?: string
  title: string
  quality?: string
  score: number | null
  meta: string
  chip: string
  chipTone: keyof typeof CHIP
  detail?: string
  auto?: FollowUpKind
  company?: { id: string; name: string }
  emailHref?: string
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
            {auto && (
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${auto.automated ? 'border-border bg-muted text-muted-foreground' : 'border-orange/50 text-orange'}`}>
                {auto.automated ? `Automated · ${auto.label}` : 'Yours'}
              </span>
            )}
            {company && <Link href={`/support/admin/crm/organizations/${company.id}`} className="underline">{company.name}</Link>}
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
          {emailHref && (
            <a href={emailHref} target="_blank" rel="noreferrer" className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">Write email</a>
          )}
          <QueueRowActions personId={personId} />
        </div>
      </div>
    </li>
  )
}

const CHIP_TONE = {
  critical: 'border-destructive/50 bg-destructive/5',
  warning: 'border-orange/50 bg-orange/10',
  good: 'border-brand/40 bg-brand/5',
} as const

/** A count of one kind of thing waiting. Coloured when there is something, quiet when there is not. */
function SummaryChip({ count, label, tone }: { count: number; label: string; tone: keyof typeof CHIP_TONE }) {
  return (
    <span className={`rounded-full border px-3 py-1 ${count > 0 ? CHIP_TONE[tone] : 'border-border text-muted-foreground'}`}>
      <span className="font-semibold tabular-nums">{count}</span> {label}
    </span>
  )
}
