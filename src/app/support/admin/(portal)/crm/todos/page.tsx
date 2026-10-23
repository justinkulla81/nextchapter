import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/crm/labels'
import { setTodoDone } from './actions'

export const maxDuration = 30

/**
 * Everything open on the CRM to-do list — mostly the next steps pulled from
 * meeting notes, oldest due date first, with what's overdue called out.
 */
export default async function CrmTodosPage() {
  await requireAdmin()
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
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const overdue = open.filter((t) => t.dueAt && t.dueAt < startOfToday)

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← CRM</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">To-dos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Next steps pulled from your Gemini meeting notes. Yours also get a reminder on your Google Calendar
          at 9:00 ET on the due date; &ldquo;Waiting on&rdquo; items are what someone else owes you.
        </p>
      </header>

      {overdue.length > 0 && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{overdue.length} overdue</p>
      )}

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing open. To-dos appear here after a meeting&apos;s Gemini notes are synced.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {open.map((t) => {
            const late = t.dueAt && t.dueAt < startOfToday
            return (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.person && <Link href={`/support/admin/crm/people/${t.person.id}`} className="underline">{t.person.fullName}</Link>}
                    {t.org && <> · <Link href={`/support/admin/crm/organizations/${t.org.id}`} className="underline">{t.org.name}</Link></>}
                    {t.opportunity && <> · {t.opportunity.title}</>}
                  </p>
                  {t.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{t.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${late ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                    {t.dueAt ? `${late ? 'Overdue · ' : 'Due '}${formatDate(t.dueAt)}` : 'No date'}
                  </span>
                  <form action={setTodoDone.bind(null, t.id, true)}>
                    <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Done</button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
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
