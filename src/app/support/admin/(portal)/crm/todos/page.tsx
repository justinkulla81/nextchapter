import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/crm/labels'
import { CrmSyncHealthAlert } from '@/components/admin/CrmSyncHealthAlert'
import { captureServerEvent } from '@/lib/posthog/server'
import { todoSource, todoTier, dueTimeLabel, TODO_TIERS, type TodoTier } from '@/lib/crm/todo-source'
import { TODO_AREA_GROUPS, areaMeta, inferArea } from '@/lib/crm/todo-areas'
import { followUpKind } from '@/lib/crm/followup-kind'
import { addTodo, setTodoDone } from './actions'

export const maxDuration = 30

type Show = 'all' | 'overdue' | 'today' | 'week' | 'later' | 'nodate'
type Sort = 'due' | 'due-desc' | 'added'
type Group = 'tier' | 'date' | 'area'

const SHOW: { key: Show; label: string }[] = [
  { key: 'all', label: 'Any date' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'nodate', label: 'No date' },
]
const SORT: { key: Sort }[] = [{ key: 'due' }, { key: 'due-desc' }, { key: 'added' }]

/** One colour per tier, used on the heading dot, the row border and the badge. */
const TONE: Record<TodoTier, { dot: string; row: string; badge: string; heading: string }> = {
  system: { dot: 'bg-error', row: 'border-error/40 bg-error/5', badge: 'bg-error text-white', heading: 'border-error/60' },
  call: { dot: 'bg-light-blue', row: 'border-light-blue/40 bg-light-blue/5', badge: 'bg-light-blue text-white', heading: 'border-light-blue/50' },
  todo: { dot: 'bg-orange', row: 'border-orange/40 bg-orange/5', badge: 'bg-orange text-navy', heading: 'border-orange/60' },
  automated: { dot: 'bg-gray', row: 'border-border bg-muted/30', badge: 'bg-light-gray text-navy', heading: 'border-border' },
}

const DEFAULT_TIERS: TodoTier[] = ['system', 'call', 'todo']
const BASE = '/support/admin/crm/todos'

/** 2–4 choices as adjacent buttons (radio under the hood, so the GET form still works). */
function Choice({ name, label, value, options }: { name: string; label: string; value: string; options: { key: string; label: string }[] }) {
  return (
    <fieldset className="text-xs text-muted-foreground">
      <legend className="mb-1">{label}</legend>
      <div className="flex overflow-hidden rounded-md border border-border">
        {options.map((o) => (
          <label key={o.key} className="cursor-pointer border-r border-border text-sm text-foreground last:border-r-0">
            <input type="radio" name={name} value={o.key} defaultChecked={value === o.key} className="peer sr-only" />
            <span className="block px-3 py-1.5 hover:bg-muted peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-light-blue">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * The CRM to-do list. Every open task has a tier (P000 system issue, P00 from
 * a call, P0 your own, plus the automated lead tasks) shown as a colour, and
 * the list filters, sorts and groups by it. The daily digest's "Do today"
 * section reads the same tiers.
 */
export default async function CrmTodosPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin()
  const sp = await searchParams

  const rawTiers = ([] as string[]).concat(sp.tier ?? [])
  const picked = TODO_TIERS.map((t) => t.key).filter((k) => rawTiers.includes(k))
  const tiers: TodoTier[] = picked.length ? picked : DEFAULT_TIERS
  const show = (SHOW.find((s) => s.key === one(sp.show))?.key ?? 'all') as Show
  const sort = (SORT.find((s) => s.key === one(sp.sort))?.key ?? 'due') as Sort
  const group = (one(sp.group) === 'date' ? 'date' : one(sp.group) === 'area' ? 'area' : 'tier') as Group
  const waitingOnly = one(sp.waiting) === '1'
  const q = (one(sp.q) ?? '').trim().slice(0, 100)
  const hideFollowUps = one(sp.nofu) === '1'
  const filtered = hideFollowUps || picked.length > 0 || show !== 'all' || sort !== 'due' || group !== 'tier' || waitingOnly || q !== ''

  const todayEnd = new Date()
  todayEnd.setHours(24, 0, 0, 0)
  const [open, done, fuPeople, fuCompanies] = await Promise.all([
    prisma.crmTask.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      include: {
        person: { select: { id: true, fullName: true } },
        org: { select: { id: true, name: true, orgTypes: true } },
        opportunity: { select: { id: true, title: true } },
      },
    }),
    prisma.crmTask.findMany({
      where: { status: 'DONE' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, completedAt: true },
    }),
    // People and company follow-ups that are due (overdue or today), the same ones the People and Company follow-ups lists show.
    hideFollowUps ? Promise.resolve([]) : prisma.crmPerson.findMany({
      where: { deletedAt: null, nextFollowUpAt: { not: null, lt: todayEnd }, passedAt: null },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 60,
      select: { id: true, fullName: true, email: true, guessedEmail: true, nextFollowUpAt: true, nextFollowUpNote: true, queueSnoozedAt: true, affiliations: { orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1, select: { org: { select: { id: true, name: true } } } } },
    }),
    hideFollowUps ? Promise.resolve([]) : prisma.crmOpportunity.findMany({
      where: { outcome: 'OPEN', orgId: { not: null }, OR: [{ committedFollowUpAt: { lt: todayEnd } }, { committedFollowUpAt: null, nextStepDueAt: { lt: todayEnd } }], org: { queueSnoozedAt: null } },
      orderBy: [{ committedFollowUpAt: 'asc' }, { nextStepDueAt: 'asc' }],
      take: 40,
      select: { id: true, title: true, nextStep: true, committedTo: true, committedFollowUpAt: true, nextStepDueAt: true, org: { select: { id: true, name: true } } },
    }),
  ])

  type FollowUpItem = { key: string; title: string; note: string | null; due: Date; href: string; company: { id: string; name: string } | null; label: string; automated: boolean; emailHref?: string }
  const needle0 = q.toLowerCase()
  const followUpItems: FollowUpItem[] = [
    ...fuPeople
      .filter((p) => !p.queueSnoozedAt || p.queueSnoozedAt < p.nextFollowUpAt!)
      .map((p): FollowUpItem => {
        const k = followUpKind(p.nextFollowUpNote)
        return {
          key: `p-${p.id}`, title: p.fullName, note: p.nextFollowUpNote, due: p.nextFollowUpAt!, href: `/support/admin/crm/people/${p.id}`, company: p.affiliations[0]?.org ?? null,
          label: k.automated ? `Automated · ${k.label}` : 'Person follow-up', automated: k.automated,
          emailHref: k.type === 'layoffs' && (p.email ?? p.guessedEmail) && p.affiliations[0] ? `/support/admin/crm/people/${p.id}/layoff-email` : undefined,
        }
      }),
    ...fuCompanies.map((o): FollowUpItem => ({
      key: `o-${o.id}`, title: o.org!.name, note: [o.title, o.committedTo ? `Promised: ${o.committedTo}` : o.nextStep].filter(Boolean).join(' · '), due: (o.committedFollowUpAt ?? o.nextStepDueAt)!,
      href: `/support/admin/crm/organizations/${o.org!.id}`, company: o.org, label: 'Company follow-up', automated: false,
    })),
  ]
    .filter((f) => !needle0 || [f.title, f.note, f.company?.name].some((x) => x?.toLowerCase().includes(needle0)))
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const all = open.map((t) => ({ ...t, tier: todoTier(t), waiting: todoSource(t) === 'waiting', areaKey: inferArea({ ...t, orgTypes: t.org?.orgTypes }) }))
  const isLate = (t: { dueAt: Date | null }) => !!t.dueAt && t.dueAt < startOfToday
  const countTier = (k: TodoTier) => all.filter((t) => t.tier === k).length
  const lateTier = (k: TodoTier) => all.filter((t) => t.tier === k && isLate(t)).length

  const needle = q.toLowerCase()
  const dateOk = (t: { dueAt: Date | null }) =>
    show === 'all' ? true
    : show === 'nodate' ? !t.dueAt
    : !t.dueAt ? false
    : show === 'overdue' ? t.dueAt < startOfToday
    : show === 'today' ? t.dueAt >= startOfToday && t.dueAt < endOfToday
    : show === 'week' ? t.dueAt >= startOfToday && t.dueAt < endOfWeek
    : t.dueAt >= endOfWeek
  const shown = all
    .filter((t) => tiers.includes(t.tier) && dateOk(t) && (!waitingOnly || t.waiting))
    .filter((t) => !needle || [t.title, t.notes, t.person?.fullName, t.org?.name, t.opportunity?.title].some((s) => s?.toLowerCase().includes(needle)))
  const dueKey = (t: { dueAt: Date | null }, none: number) => t.dueAt?.getTime() ?? none
  shown.sort((a, b) =>
    sort === 'added' ? b.createdAt.getTime() - a.createdAt.getTime()
    : sort === 'due-desc' ? dueKey(b, -Infinity) - dueKey(a, -Infinity)
    : dueKey(a, Infinity) - dueKey(b, Infinity))

  if (filtered) {
    captureServerEvent(admin.email ?? 'admin', 'crm_todos_filtered', {
      tiers, show, sort, group, waitingOnly, hasSearch: q !== '', results: shown.length,
    })
  }

  const sections: { key: string; title: string; sub?: string; tone: TodoTier | 'plain' | 'late'; items: typeof shown }[] =
    group === 'tier'
      ? TODO_TIERS.filter((t) => tiers.includes(t.key)).map((t) => ({
          key: t.key, title: `${t.code} · ${t.label}`, sub: t.hint, tone: t.key, items: shown.filter((x) => x.tier === t.key),
        }))
      : group === 'area'
      ? TODO_AREA_GROUPS.flatMap((g) => g.areas.map((a) => ({
          key: a.key, title: g.areas.length > 1 ? `${g.group} · ${a.label}` : g.group, tone: 'plain' as const, items: shown.filter((x) => x.areaKey === a.key),
        })))
      : [
          { key: 'late', title: 'Overdue', tone: 'late' as const, items: shown.filter((t) => isLate(t)) },
          { key: 'week', title: 'Next 7 days', tone: 'plain' as const, items: shown.filter((t) => t.dueAt && t.dueAt >= startOfToday && t.dueAt < endOfWeek) },
          { key: 'later', title: 'Later', tone: 'plain' as const, items: shown.filter((t) => t.dueAt && t.dueAt >= endOfWeek) },
          { key: 'none', title: 'No date', tone: 'plain' as const, items: shown.filter((t) => !t.dueAt) },
        ]
  const visible = sections.filter((s) => s.items.length > 0)

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← CRM</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">To-dos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          System issues first, then next steps from your calls, then your own to-dos. Meeting next steps get a
          reminder on your Google Calendar at 9:00 ET on the due date. The morning brief lists the same items
          under the same names.
        </p>
      </header>

      <CrmSyncHealthAlert />

      <form action={addTodo} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <label className="min-w-64 flex-1 text-xs text-muted-foreground">
          New to-do
          <input name="title" required maxLength={300} placeholder="What needs doing?" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <Choice name="tier" label="Type" value="todo" options={[{ key: 'todo', label: 'P0 · To-do' }, { key: 'system', label: 'P000 · System issue' }]} />
        <label className="text-xs text-muted-foreground">
          Function
          <select name="area" defaultValue="" className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            <option value="">Auto</option>
            {TODO_AREA_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Due
          <input name="dueDate" type="date" className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">
          Time (ET)
          <input name="dueTime" type="time" className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="min-w-48 flex-1 text-xs text-muted-foreground">
          Note (optional)
          <input name="notes" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <button type="submit" className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Add to-do</button>
      </form>

      <form method="get" className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show these types">
          {TODO_TIERS.map((t) => {
            const late = lateTier(t.key)
            return (
              <label key={t.key} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${TONE[t.key].row}`}>
                <input type="checkbox" name="tier" value={t.key} defaultChecked={tiers.includes(t.key)} className="h-3.5 w-3.5" />
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TONE[t.key].badge}`}>{t.code}</span>
                <span>{t.label} · {countTier(t.key)}</span>
                {late > 0 && <span className="text-xs text-destructive">({late} overdue)</span>}
              </label>
            )
          })}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <input type="checkbox" name="nofu" value="1" defaultChecked={hideFollowUps} className="h-3.5 w-3.5" />
            Hide people and company follow-ups
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <input type="checkbox" name="waiting" value="1" defaultChecked={waitingOnly} className="h-3.5 w-3.5" />
            Only waiting on others
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-xs text-muted-foreground">
            Search
            <input name="q" defaultValue={q} placeholder="Title, note, person or organization" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            Due
            <select name="show" defaultValue={show} className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
              {SHOW.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <Choice name="sort" label="Sort" value={sort} options={[{ key: 'due', label: 'Soonest' }, { key: 'due-desc', label: 'Latest' }, { key: 'added', label: 'Newest added' }]} />
          <Choice name="group" label="Group by" value={group} options={[{ key: 'tier', label: 'Type' }, { key: 'area', label: 'Function' }, { key: 'date', label: 'Due date' }]} />
          <button type="submit" className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Apply filters</button>
          {filtered && <Link href={BASE} className="px-1 py-1.5 text-sm text-muted-foreground underline">Reset</Link>}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {shown.length} of {all.length} open.
          {!tiers.includes('automated') && countTier('automated') > 0 && <> {countTier('automated')} automated lead tasks are hidden; tick Automated to see them.</>}
        </p>
      </form>

      {followUpItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex flex-wrap items-center gap-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-gray" aria-hidden />
            People and company follow-ups · {followUpItems.length}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">Due today or overdue. <Link href="/support/admin/crm/queue/people" className="underline">Filter and work them on the People follow-ups list.</Link></span>
          </h2>
          <ul className="space-y-2">
            {followUpItems.map((f) => {
              const late = f.due < startOfToday
              return (
                <li key={f.key} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{f.label}</span>
                      <Link href={f.href} className="hover:underline">{f.title}</Link>
                      {f.company && f.company.name !== f.title && <Link href={`/support/admin/crm/organizations/${f.company.id}`} className="text-xs font-normal text-muted-foreground underline">{f.company.name}</Link>}
                    </p>
                    {f.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-right text-xs ${late ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>{late ? 'Overdue · ' : ''}{formatDate(f.due)}</span>
                    {f.emailHref && <a href={f.emailHref} target="_blank" rel="noreferrer" className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted">Write email</a>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {visible.length === 0 && followUpItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing open here.
        </p>
      ) : visible.length === 0 ? null : (
        visible.map((s) => {
          const tone = s.tone === 'late' || s.tone === 'plain' ? null : TONE[s.tone]
          return (
            <section key={s.key} className="space-y-2">
              <h2 className={`flex flex-wrap items-center gap-2 border-b pb-1 text-xs font-semibold uppercase tracking-wide ${tone?.heading ?? (s.tone === 'late' ? 'border-destructive/60 text-destructive' : 'border-border')}`}>
                <span className={`h-2 w-2 rounded-full ${tone?.dot ?? (s.tone === 'late' ? 'bg-destructive' : 'bg-gray')}`} aria-hidden />
                {s.title} · {s.items.length}
                {s.sub && <span className="font-normal normal-case tracking-normal text-muted-foreground">{s.sub}</span>}
              </h2>
              <ul className="space-y-2">
                {s.items.map((t) => {
                  const late = isLate(t)
                  const tm = TODO_TIERS.find((x) => x.key === t.tier)!
                  const time = t.dueAt ? dueTimeLabel(t.dueAt) : null
                  return (
                    <li key={t.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm ${TONE[t.tier].row}`}>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TONE[t.tier].badge}`}>{tm.code}</span>
                          {t.waiting && <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Waiting on them</span>}
                          <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{areaMeta(t.areaKey).label}</span>
                          <span>{t.title}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t.person && <Link href={`/support/admin/crm/people/${t.person.id}`} className="underline">{t.person.fullName}</Link>}
                          {t.org && <>{t.person ? ' · ' : ''}<Link href={`/support/admin/crm/organizations/${t.org.id}`} className="underline">{t.org.name}</Link></>}
                          {t.opportunity && <> · {t.opportunity.title}</>}
                        </p>
                        {t.notes && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-right text-xs ${late ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                          {t.dueAt ? `${late ? 'Overdue · ' : ''}${formatDate(t.dueAt)}` : 'No date'}
                          {time && <span className="block">{time}</span>}
                        </span>
                        <form action={setTodoDone.bind(null, t.id, true)}>
                          <button type="submit" className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted">Done</button>
                        </form>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Recently done</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {done.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm text-muted-foreground">
                <span className="line-through">{t.title}</span>
                <form action={setTodoDone.bind(null, t.id, false)}>
                  <button type="submit" className="text-xs underline">Reopen</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
