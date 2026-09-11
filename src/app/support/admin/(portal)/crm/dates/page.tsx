import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmDateCheckButton } from '@/components/admin/CrmDateCheckButton'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 30
const DAY = 86_400_000

/** Monday-anchored week label, so dates group the way a week actually reads. */
function weekOf(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7
  const monday = new Date(d.getTime() - day * DAY)
  return monday.toISOString().slice(0, 10)
}

export default async function CrmDatesPage() {
  await requireAdmin()
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * DAY)

  const [upcoming, past, undated] = await Promise.all([
    prisma.crmDeadline.findMany({
      where: { dueAt: { gte: now, lte: in90 } },
      orderBy: { dueAt: 'asc' },
      select: { id: true, label: true, dueAt: true, kind: true, sourceUrl: true, org: { select: { id: true, name: true, website: true } } },
    }),
    prisma.crmDeadline.findMany({
      where: { dueAt: { lt: now } },
      orderBy: { dueAt: 'desc' },
      select: { id: true, label: true, dueAt: true, sourceUrl: true, lastCheckedAt: true, org: { select: { id: true, name: true, website: true } } },
    }),
    prisma.crmDeadline.count({ where: { dueAt: null } }),
  ])

  const byWeek = new Map<string, typeof upcoming>()
  for (const d of upcoming) {
    if (!d.dueAt) continue
    const k = weekOf(d.dueAt)
    byWeek.set(k, [...(byWeek.get(k) ?? []), d])
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Upcoming dates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every pipeline, ninety days out, grouped by week.
          </p>
        </div>
        <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Queue
        </Link>
      </header>

      <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">{undated}</strong> records carry no date at all — almost all of them say
        “Rolling”. They are not missing data: for most funders there is genuinely no date to track, which is why
        priority leans on warm paths and grade rather than on urgency.
      </p>

      {upcoming.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing dated in the next 90 days.</p>
          <p className="mt-1 text-sm text-muted-foreground">Past-due records below can be checked for a new date.</p>
        </div>
      ) : (
        <section className="space-y-5">
          {[...byWeek.entries()].map(([week, items]) => {
            const start = new Date(`${week}T00:00:00Z`)
            const daysAway = Math.ceil((start.getTime() - now.getTime()) / DAY)
            return (
              <div key={week}>
                <h2 className="text-sm font-semibold">
                  Week of {start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {daysAway <= 0 ? 'this week' : `in ${daysAway} days`}
                  </span>
                </h2>
                <ul className="mt-2 space-y-2">
                  {items.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <span>
                        {d.org ? (
                          <Link href={`/support/admin/crm/organizations/${d.org.id}`} className="font-medium hover:underline">{d.org.name}</Link>
                        ) : <span className="font-medium">{d.label}</span>}
                        <span className="ml-2 text-muted-foreground">{d.label}</span>
                      </span>
                      <span className="text-xs font-medium">{formatDate(d.dueAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Passed ({past.length})</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Checking fetches the source page and shows any dates it finds, with the sentence each came from.
            It never writes a date for you, and a result is reused for 24 hours rather than re-fetching.
          </p>
          <ul className="mt-3 space-y-2">
            {past.map((d) => (
              <li key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {d.org ? (
                      <Link href={`/support/admin/crm/organizations/${d.org.id}`} className="hover:underline">{d.org.name}</Link>
                    ) : d.label}
                    <span className="ml-2 font-normal text-muted-foreground">{d.label}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    was {formatDate(d.dueAt)}
                    {d.lastCheckedAt && ` · checked ${formatDate(d.lastCheckedAt)}`}
                  </span>
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
