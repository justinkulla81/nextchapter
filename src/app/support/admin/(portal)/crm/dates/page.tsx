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
                <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left">
                        <th className="px-3 py-1.5 font-medium">Organization</th>
                        <th className="px-3 py-1.5 font-medium">Program</th>
                        <th className="px-3 py-1.5 font-medium whitespace-nowrap">Deadline</th>
                        <th className="px-3 py-1.5 text-right font-medium whitespace-nowrap">Days left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d) => {
                        const left = d.dueAt ? Math.ceil((d.dueAt.getTime() - now.getTime()) / DAY) : null
                        return (
                          <tr key={d.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5">
                              {d.org ? (
                                <Link href={`/support/admin/crm/organizations/${d.org.id}`} className="font-medium hover:underline">{d.org.name}</Link>
                              ) : <span className="font-medium">{d.label}</span>}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{d.label}</td>
                            <td className="px-3 py-1.5 font-medium whitespace-nowrap">{formatDate(d.dueAt)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                              {left === null ? '—' : left <= 0 ? 'today' : left}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
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
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-1.5 font-medium">Organization</th>
                  <th className="px-3 py-1.5 font-medium">Program</th>
                  <th className="px-3 py-1.5 font-medium whitespace-nowrap">Deadline</th>
                  <th className="px-3 py-1.5 font-medium whitespace-nowrap">Last checked</th>
                  <th className="px-3 py-1.5 font-medium">Check for a new date</th>
                </tr>
              </thead>
              <tbody>
                {past.map((d) => (
                  <tr key={d.id} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-1.5">
                      {d.org ? (
                        <Link href={`/support/admin/crm/organizations/${d.org.id}`} className="font-medium hover:underline">{d.org.name}</Link>
                      ) : <span className="font-medium">{d.label}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{d.label}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-destructive">{formatDate(d.dueAt)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                      {d.lastCheckedAt ? formatDate(d.lastCheckedAt) : 'Never'}
                    </td>
                    <td className="min-w-72 px-3 py-1.5">
                      <CrmDateCheckButton deadlineId={d.id} hasSource={Boolean(d.sourceUrl ?? d.org?.website)} sourceUrl={d.sourceUrl ?? d.org?.website} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
