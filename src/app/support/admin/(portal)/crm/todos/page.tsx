import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/crm/labels'
import { CrmSyncHealthAlert } from '@/components/admin/CrmSyncHealthAlert'
import { todoSource, type TodoSource } from '@/lib/crm/todo-source'
import { addTodo, setTodoDone } from './actions'

export const maxDuration = 30

type View = TodoSource | 'all'

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: 'yours', label: 'Yours', hint: 'Things you added and your next steps from meetings.' },
  { key: 'waiting', label: 'Waiting on others', hint: 'What someone else owes you, from meeting notes. Chase these.' },
  { key: 'automated', label: 'Automated', hint: 'Created by the system from layoff and news leads. Work them or clear them; they are not commitments.' },
  { key: 'all', label: 'All', hint: 'Everything open.' },
]

/**
 * The CRM to-do list, split by where each item came from so your own
 * commitments are not buried under automated lead tasks.
 */
export default async function CrmTodosPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : 'yours'

  const [open, done] = await Promise.all([
    prisma.crmTask.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      include: {
        person: { select: { id: true, fullName: true } },
        org: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
    }),
    prisma.crmTask.findMany({
      where: { status: 'DONE' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { id: true, title: true, completedAt: true },
    }),
  ])

  const tagged = open.map((t) => ({ ...t, source: todoSource(t) }))
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  const countFor = (v: View) => (v === 'all' ? tagged.length : tagged.filter((t) => t.source === v).length)
  const overdueCount = (v: View) =>
    tagged.filter((t) => (v === 'all' || t.source === v) && t.dueAt && t.dueAt < startOfToday).length
  const shown = tagged.filter((t) => view === 'all' || t.source === view)

  const buckets = [
    { title: 'Overdue', tone: 'text-destructive', items: shown.filter((t) => t.dueAt && t.dueAt < startOfToday) },
    { title: 'Next 7 days', tone: '', items: shown.filter((t) => t.dueAt && t.dueAt >= startOfToday && t.dueAt < endOfWeek) },
    { title: 'Later', tone: '', items: shown.filter((t) => t.dueAt && t.dueAt >= endOfWeek) },
    { title: 'No date', tone: '', items: shown.filter((t) => !t.dueAt) },
  ].filter((b) => b.items.length > 0)

  const current = VIEWS.find((v) => v.key === view)!

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← CRM</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">To-dos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Your own to-dos come first. Meeting next steps get a reminder on your Google Calendar at 9:00 ET on the
          due date. Items the system created are kept in their own tab so they never crowd yours.
        </p>
      </header>

      <CrmSyncHealthAlert />

      <form action={addTodo} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <label className="min-w-64 flex-1 text-xs text-muted-foreground">
          New to-do
          <input name="title" required maxLength={300} placeholder="What needs doing?" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">
          Due
          <input name="dueDate" type="date" className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="min-w-48 flex-1 text-xs text-muted-foreground">
          Note (optional)
          <input name="notes" className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Add</button>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="To-do source">
        {VIEWS.map((v) => {
          const n = countFor(v.key)
          const late = overdueCount(v.key)
          return (
            <Link
              key={v.key}
              href={v.key === 'yours' ? '/support/admin/crm/todos' : `/support/admin/crm/todos?view=${v.key}`}
              role="tab"
              aria-selected={view === v.key}
              className={`rounded-md border px-3 py-1.5 text-sm ${view === v.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
            >
              {v.label} · {n}
              {late > 0 && <span className={`ml-1.5 text-xs ${view === v.key ? '' : 'text-destructive'}`}>({late} overdue)</span>}
            </Link>
          )
        })}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{current.hint}</p>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing open here.
        </p>
      ) : (
        buckets.map((b) => (
          <section key={b.title}>
            <h2 className={`mb-2 text-sm font-semibold ${b.tone}`}>{b.title} · {b.items.length}</h2>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {b.items.map((t) => {
                const late = t.dueAt && t.dueAt < startOfToday
                return (
                  <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.person && <Link href={`/support/admin/crm/people/${t.person.id}`} className="underline">{t.person.fullName}</Link>}
                        {t.org && <>{t.person ? ' · ' : ''}<Link href={`/support/admin/crm/organizations/${t.org.id}`} className="underline">{t.org.name}</Link></>}
                        {t.opportunity && <> · {t.opportunity.title}</>}
                      </p>
                      {t.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{t.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${late ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                        {t.dueAt ? formatDate(t.dueAt) : 'No date'}
                      </span>
                      <form action={setTodoDone.bind(null, t.id, true)}>
                        <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Done</button>
                      </form>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
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
