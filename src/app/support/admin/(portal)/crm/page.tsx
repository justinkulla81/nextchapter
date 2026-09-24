import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { CrmQuickAdd } from '@/components/admin/CrmQuickAdd'
import { CrmSyncButton } from '@/components/admin/CrmSyncButton'
import { CrmBulkBar } from '@/components/admin/CrmBulkBar'
import { CrmInlineSelect } from '@/components/admin/CrmInlineSelect'
import { CrmInlineOrgEdit } from '@/components/admin/CrmInlineOrgEdit'
import { CrmInlineRoles } from '@/components/admin/CrmInlineRoles'
import { CrmPeekPanel, CrmPeekButton } from '@/components/admin/CrmPeekPanel'
import { SortHeader, readSort } from '@/components/admin/SortHeader'
import { CrmContactCell } from '@/components/admin/CrmContactCell'
import { CrmInlineFollowUp } from '@/components/admin/CrmInlineFollowUp'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { CrmEmailBackfillPrompt } from '@/components/admin/CrmEmailBackfillPrompt'
import { CrmInlineGoals } from '@/components/admin/CrmInlineGoals'
import { StickyFilters } from '@/components/admin/StickyFilters'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS,
  WARMTHS, WARMTH_LABELS, PRIORITY_TIERS, PRIORITY_TIER_LABELS,
  priorityTierClass, sinceLabel,
} from '@/lib/crm/labels'
import type { CrmPersonRole, CrmLeadQuality, CrmWarmth, CrmGoal, CrmPriorityTier } from '@prisma/client'
import { GOALS, GOAL_LABELS } from '@/lib/crm/goals'

export const maxDuration = 30

// 100 by default: with 3,688 people, 50 meant paging constantly, and 200 makes
// the first paint noticeably slower. Overridable per view.
// 1500 is deliberately offered and deliberately last: it exists for a bulk
// pass over a filtered set, and it renders 1500 rows of inline controls, which
// is noticeably slow. Naming it "everything" would hide that.
const PAGE_SIZES = [50, 100, 200, 1500] as const
const DEFAULT_PAGE_SIZE = 100

// The filters this list was last worked with, kept across sessions. See
// StickyFilters for why a cookie.
const STICKY_COOKIE = 'crm_people_filters'

function searchTokens(q: string): string[] {
  return q.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 6)
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Names that are one or two typos away from what was searched.
 *
 * Only runs when a search finds nobody, so it costs nothing on the common
 * path. Every searched word must land within two edits of some word in the
 * name — "andre benin" finds "Andre Bennin", "andy milller" finds "Andy
 * Miller" — which is loose enough to catch a slip and tight enough not to
 * return half the CRM.
 */
async function nearMisses(q: string): Promise<{ id: string; fullName: string }[]> {
  const tokens = searchTokens(q.toLowerCase()).filter((t) => t.length >= 3)
  if (tokens.length === 0) return []
  const people = await prisma.crmPerson.findMany({ where: { deletedAt: null }, select: { id: true, fullName: true } })
  const scored: { id: string; fullName: string; score: number }[] = []
  for (const p of people) {
    const words = p.fullName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let total = 0
    let ok = true
    for (const t of tokens) {
      const best = Math.min(...words.map((w) => (w.startsWith(t) ? 0 : editDistance(t, w))), 3)
      if (best > 2) { ok = false; break }
      total += best
    }
    if (ok) scored.push({ id: p.id, fullName: p.fullName, score: total })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, 6)
}

/** Whole days since `when`, or null. Counted here so the row component stays
 * pure — see CrmInlineFollowUp's `awaitingDays`. */
function daysSince(when: Date | null): number | null {
  return when ? Math.floor((Date.now() - when.getTime()) / 86_400_000) : null
}

export default async function CrmPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams

  // A bare visit restores the remembered view. Only a BARE one: any param at
  // all (including ?reset=1, which Clear uses) is a deliberate choice about
  // what to look at and is never overridden.
  if (Object.keys(sp).length === 0) {
    const saved = (await cookies()).get(STICKY_COOKIE)?.value
    // `restored=1` is the banner's only signal that this view was silently
    // applied rather than chosen just now — without it, someone you just
    // logged a contact with can vanish from "never contacted" with nothing
    // on screen explaining why.
    if (saved) redirect(`/support/admin/crm?${decodeURIComponent(saved)}&restored=1`)
  }
  const restored = sp.restored === '1'

  const q = (sp.q ?? '').trim()
  const role = sp.role ?? ''
  const quality = sp.quality ?? ''
  const warmth = sp.warmth ?? ''
  const touched = sp.touched ?? ''
  const waiting = sp.waiting ?? ''
  const invited = sp.invited === '1' ? '1' : ''
  const goal = sp.goal ?? ''
  const priority = sp.priority ?? ''
  const minScore = parseInt(sp.minScore ?? '', 10)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  // Organization is not sortable: it lives on a to-many affiliation, which
  // Prisma cannot order by. Offering a column that silently did nothing would
  // be worse than leaving it plain.
  const SORTS = ['name', 'quality', 'warmth', 'touched', 'score']
  const sort = readSort(sp, SORTS, { sort: 'score', dir: 'desc' })
  // P0/P1/P2 rows lead every ordering, in that order; unset sorts last. A
  // tier that merely added points would sometimes still sit below the fold,
  // which is the one thing it must not do.
  const PINNED = { priority: { sort: 'asc', nulls: 'last' } } as const
  const orderBy =
    sort.sort === 'name' ? [PINNED, { fullName: sort.dir }]
    : sort.sort === 'quality' ? [PINNED, { leadQuality: sort.dir }, { fullName: 'asc' as const }]
    : sort.sort === 'warmth' ? [PINNED, { warmth: sort.dir }, { fullName: 'asc' as const }]
    : sort.sort === 'touched' ? [PINNED, { lastTouchedAt: { sort: sort.dir, nulls: 'last' as const } }]
    : [PINNED, { priorityScore: sort.dir }, { fullName: 'asc' as const }]

  const requested = parseInt(sp.per ?? '', 10)
  const perPage = (PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_PAGE_SIZE

  const where: Prisma.CrmPersonWhereInput = {
    deletedAt: null,
    // Every word has to match somewhere, but not side by side: "andre benin"
    // used to be matched as one string, so a middle initial, a reordered name
    // or "andy miller" against "Andrew Miller" found nothing at all.
    ...(q
      ? {
          AND: searchTokens(q).map((t) => ({
            OR: [
              { fullName: { contains: t, mode: 'insensitive' as const } },
              { email: { contains: t, mode: 'insensitive' as const } },
              { notes: { contains: t, mode: 'insensitive' as const } },
              { linkedinUrl: { contains: t, mode: 'insensitive' as const } },
              { affiliations: { some: { org: { name: { contains: t, mode: 'insensitive' as const } } } } },
              { affiliations: { some: { title: { contains: t, mode: 'insensitive' as const } } } },
            ],
          })),
        }
      : {}),
    ...(role ? { roles: { has: role as CrmPersonRole } } : {}),
    ...(quality ? { leadQuality: quality as CrmLeadQuality } : {}),
    ...(warmth ? { warmth: warmth as CrmWarmth } : {}),
    ...(touched === 'never' ? { lastTouchedAt: null } : {}),
    ...(touched === 'ever' ? { lastTouchedAt: { not: null } } : {}),
    ...(waiting === 'waiting' ? { awaitingReplySince: { not: null }, passedAt: null, keepInTouchAt: null } : {}),
    ...(waiting === 'not-waiting' ? { awaitingReplySince: null } : {}),
    ...(waiting === 'passed' ? { passedAt: { not: null } } : {}),
    ...(waiting === 'keep-in-touch' ? { keepInTouchAt: { not: null } } : {}),
    ...(invited ? { candidateInvitedAt: { not: null } } : {}),
    ...(goal ? { goals: { has: goal as CrmGoal } } : {}),
    ...(Number.isFinite(minScore) ? { priorityScore: { gte: minScore } } : {}),
    ...(priority ? { priority: priority as CrmPriorityTier } : {}),
  }

  const [total, rows, needsCompletion, removedCount, orgNames] = await Promise.all([
    prisma.crmPerson.count({ where }),
    prisma.crmPerson.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, fullName: true, email: true, roles: true, goals: true, leadQuality: true, warmth: true, priority: true,
        lastTouchedAt: true, touchCount: true, awaitingReplySince: true, passedAt: true, keepInTouchAt: true, priorityScore: true, linkedinUrl: true,
        nextFollowUpNote: true, nextFollowUpAt: true, candidateId: true, candidateInvitedAt: true,
        affiliations: {
          where: { isPrimary: true }, take: 1,
          select: { title: true, org: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
    prisma.crmPerson.count({ where: { deletedAt: { not: null } } }),
    prisma.crmOrganization.findMany({ select: { name: true }, orderBy: { name: 'asc' }, take: 5000 }),
  ])

  const restoredSummary = restored
    ? [
        q && `search “${q}”`,
        role && `contact type ${PERSON_ROLE_LABELS[role as CrmPersonRole]}`,
        quality && `quality ${QUALITY_LABELS[quality as CrmLeadQuality]}`,
        warmth && `warmth ${WARMTH_LABELS[warmth as CrmWarmth]}`,
        touched === 'never' && 'never contacted',
        touched === 'ever' && 'contacted at least once',
        waiting === 'waiting' && 'waiting on their reply',
        waiting === 'not-waiting' && 'not waiting on them',
        waiting === 'passed' && 'not interested',
        waiting === 'keep-in-touch' && 'keep in touch',
        invited && 'invited to NextChapter',
        goal && `goal ${GOAL_LABELS[goal as CrmGoal]}`,
        priority && `priority ${priority}`,
        Number.isFinite(minScore) && `score ${minScore}+`,
      ].filter((x): x is string => Boolean(x))
    : []

  const suggestions = total === 0 && q ? await nearMisses(q) : []

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const baseParams = {
    q, role, quality, warmth, touched, waiting, invited, goal, priority,
    minScore: Number.isFinite(minScore) ? String(minScore) : '',
    per: String(perPage), sort: sort.sort, dir: sort.dir,
  }
  // What gets remembered: the filters and the view settings, never the page
  // number — resuming on page 7 of a list you last opened yesterday is not
  // "where I left off", it's disorienting.
  const stickyQs = (() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(baseParams)) if (v) p.set(k, String(v))
    return p.toString()
  })()

  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...baseParams, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <CrmPeekPanel />
      <datalist id="crm-org-names">
        <option value="- Unemployed" />
        <option value="- Entrepreneur" />
        <option value="- Advisor" />
        <option value="- Freelancer" />
        {orgNames.map((o) => <option key={o.name} value={o.name} />)}
      </datalist>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">NextChapter Ecosystem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone around NextChapter — investors, partners, employers, coaches, recruiters, policy people
            and job seekers — in one place, whatever combination of those they are.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted">
            Queue
          </Link>
          <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            All leads
          </Link>
          <Link href="/support/admin/crm/pipelines" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Pipelines
          </Link>
          <Link href="/support/admin/crm/organizations" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Organizations
          </Link>
          <Link href="/support/admin/crm/research" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Research
          </Link>
          <Link href="/support/admin/crm/removed" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Removed{removedCount > 0 && <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 text-xs font-semibold text-muted-foreground">{removedCount}</span>}
          </Link>
          <Link href="/support/admin/crm/sync" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Activity sync
          </Link>
          <Link href="/support/admin/crm/segments" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Segments
          </Link>
          <Link href="/support/admin/crm/capture-tokens" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Capture tokens
          </Link>
          <Link href="/support/admin/crm/needs-completion" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Review List{needsCompletion > 0 && <span className="ml-1.5 rounded-full bg-orange/20 px-1.5 text-xs font-semibold text-orange">{needsCompletion}</span>}
          </Link>
          <CrmSyncButton />
          <Link href={`/support/admin/crm/export?${qs({})}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" prefetch={false}>
            Download CSV
          </Link>
          <Link href="/support/admin/crm/import" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Upload CSV
          </Link>
        </nav>
      </header>

      <CrmQuickAdd />

      <StickyFilters name={STICKY_COOKIE} value={stickyQs} />

      {restoredSummary.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">Showing your last filters:</span>{' '}
            <span className="text-muted-foreground">{restoredSummary.join(' · ')}</span>
          </span>
          <Link href="/support/admin/crm?reset=1" className="ml-auto text-sm font-medium text-brand underline underline-offset-2">
            Clear
          </Link>
        </div>
      )}

      <AdminFilterBar
        basePath="/support/admin/crm"
        clearHref="/support/admin/crm?reset=1"
        searchValue={q}
        searchPlaceholder="Search name, company, title, email or notes…"
        filters={[
          { key: 'role', label: 'Contact type', value: role, options: [{ value: '', label: 'Any contact type' }, ...PERSON_ROLES.map((r) => ({ value: r, label: PERSON_ROLE_LABELS[r] }))] },
          { key: 'quality', label: 'Quality', value: quality, options: [{ value: '', label: 'Any quality' }, ...QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))] },
          { key: 'warmth', label: 'Warmth', value: warmth, options: [{ value: '', label: 'Any warmth' }, ...WARMTHS.map((x) => ({ value: x, label: WARMTH_LABELS[x] }))] },
          { key: 'touched', label: 'Contact', value: touched, options: [{ value: '', label: 'Contacted or not' }, { value: 'never', label: 'Never contacted' }, { value: 'ever', label: 'Contacted at least once' }] },
          { key: 'waiting', label: 'Waiting on reply', value: waiting, options: [{ value: '', label: 'Waiting or not' }, { value: 'waiting', label: 'Waiting on their reply' }, { value: 'not-waiting', label: 'Not waiting on them' }, { value: 'passed', label: 'Not interested' }, { value: 'keep-in-touch', label: 'Keep in touch (newsletter)' }] },
          { key: 'invited', label: 'Invited', value: invited, options: [{ value: '', label: 'Invited or not' }, { value: '1', label: 'Invited to NextChapter' }] },
          { key: 'goal', label: 'Goal', value: goal, options: [{ value: '', label: 'Any goal' }, ...GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))] },
          // Thresholds match the real distribution: people top out around 67
          // and cluster near 30, so 70+ would match nobody and 30+ everybody.
          // Labelled the way the rows are: the badge on every row says P0, so
          // a filter offering "Immediate" made you translate between the two.
          { key: 'priority', label: 'Priority', value: priority, options: [{ value: '', label: 'Any priority' }, ...PRIORITY_TIERS.map((t) => ({ value: t, label: `${t} — ${PRIORITY_TIER_LABELS[t]}` }))] },
    // (banner reads these back below — see restoredSummary)
          // This one filters the computed score, not the tier — two dropdowns
          // both reading "Priority: All" was just ambiguous.
          { key: 'minScore', label: 'Score', value: Number.isFinite(minScore) ? String(minScore) : '', options: [{ value: '', label: 'Any score' }, { value: '45', label: 'Top — 45+' }, { value: '40', label: 'High — 40+' }, { value: '35', label: 'Above average — 35+' }] },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
          {q || role || quality || warmth || touched || waiting || invited ? ' matching these filters' : ''}
        </p>
        {/* Three discrete options -> adjacent buttons, per design-principles.md. */}
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="People per page">
          <span className="text-muted-foreground">Show</span>
          {PAGE_SIZES.map((n) => (
            <Link
              key={n}
              href={`/support/admin/crm?${qs({ per: n, page: 1 })}`}
              aria-current={perPage === n ? 'page' : undefined}
              className={`rounded-md border px-2 py-1 ${perPage === n ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}
            >
              {n}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No one matches these filters.</p>
          {suggestions.length > 0 ? (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Did you mean </span>
              {suggestions.map((sg, i) => (
                <span key={sg.id}>
                  {i > 0 && ', '}
                  <CrmPeekButton id={sg.id} kind="person">{sg.fullName}</CrmPeekButton>
                </span>
              ))}
              <span className="text-muted-foreground">?</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Clear the search, or add someone with the box above.
            </p>
          )}
          {/* ?reset=1, not the bare URL — a bare visit restores the
              remembered filters, which would put you straight back here. */}
          <Link href="/support/admin/crm?reset=1" className="mt-3 inline-block text-sm font-medium text-brand underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <CrmBulkBar count={rows.length}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="w-8 px-3 py-2">
                    <CrmSelectAll pageCount={rows.length} />
                  </th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <SortHeader label="Name" sortKey="name" current={sort} basePath="/support/admin/crm" params={baseParams} />
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <SortHeader label="Contacted" sortKey="touched" current={sort} basePath="/support/admin/crm" params={baseParams} defaultDir="desc" />
                  <th className="px-3 py-2 font-medium">Contact type</th>
                  <th className="px-3 py-2 font-medium">Goal</th>
                  <th className="px-3 py-2 font-medium">Deal status</th>
                  <SortHeader label="Score" sortKey="score" current={sort} basePath="/support/admin/crm" params={baseParams} defaultDir="desc" className="px-3 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input type="checkbox" name="selected" value={p.id} aria-label={`Select ${p.fullName}`} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {/* The dropdown IS the colored badge — was a plain-text
                          pill next to a second, spelled-out select repeating
                          the same value; one control reads the same and
                          gives the row's width back to Organization. */}
                      <CrmInlineSelect
                        personId={p.id} field="priority" value={p.priority ?? ''}
                        label={`Priority for ${p.fullName}`}
                        className={priorityTierClass(p.priority)}
                        options={[{ value: '', label: '—' }, ...PRIORITY_TIERS.map((t) => ({ value: t, label: t }))]}
                      />
                    </td>
                    {/* Three lines per person, fixed. A LinkedIn headline can
                        run five lines on its own and was setting the height of
                        the whole row; it truncates here and the full text is
                        one hover (or the peek panel) away. */}
                    <td className="max-w-xs px-3 py-1.5">
                      <CrmPeekButton id={p.id} kind="person">{p.fullName}</CrmPeekButton>
                      {p.candidateId ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" title="Has a NextChapter candidate account">
                          ✓ NC account
                        </span>
                      ) : p.candidateInvitedAt ? (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 align-middle text-[11px] text-muted-foreground" title="Invited to NextChapter — no account linked yet">
                          Invited
                        </span>
                      ) : null}
                      {p.affiliations[0]?.title && (
                        <span className="block truncate text-xs text-muted-foreground" title={p.affiliations[0].title}>
                          {p.affiliations[0].title}
                        </span>
                      )}
                      <span className="block">
                        <CrmEmailBackfillPrompt personId={p.id} email={p.email} />
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {/* A real width, set on the contents: the cell holds an input,
                          which has no natural width in a table and was collapsing
                          the column to 3-4 letters ("Neb", "Wal"). ~30 characters
                          show; anything longer is in the tooltip. */}
                      <div className="flex w-60 items-center gap-1.5">
                        <CrmInlineOrgEdit personId={p.id} orgName={p.affiliations[0]?.org.name ?? null} />
                        {p.affiliations[0]?.org && (
                          <CrmPeekButton id={p.affiliations[0].org.id} kind="org" className="shrink-0 text-xs text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                            view
                          </CrmPeekButton>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <CrmContactCell
                        personId={p.id} name={p.fullName}
                        lastLabel={sinceLabel(p.lastTouchedAt)} touchCount={p.touchCount}
                        awaitingReply={p.awaitingReplySince !== null && p.passedAt === null && p.keepInTouchAt === null}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <CrmInlineRoles personId={p.id} roles={p.roles} name={p.fullName} />
                    </td>
                    <td className="px-3 py-1.5">
                      <CrmInlineGoals personId={p.id} goals={p.goals} name={p.fullName} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <CrmInlineFollowUp
                        personId={p.id} note={p.nextFollowUpNote} dueAt={p.nextFollowUpAt}
                        awaitingDays={daysSince(p.awaitingReplySince)} passed={p.passedAt !== null} keepInTouch={p.keepInTouchAt !== null}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(p.priorityScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CrmBulkBar>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={`/support/admin/crm?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/support/admin/crm?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
