import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { dismissUnsubscribeRequest, processUnsubscribeRequests } from '../actions'

/** Business days between two dates, weekends skipped. */
function businessDaysSince(d: Date): number {
  let n = 0
  const cur = new Date(d)
  while (cur < new Date()) {
    cur.setDate(cur.getDate() + 1)
    if (cur.getDay() !== 0 && cur.getDay() !== 6 && cur <= new Date()) n++
  }
  return n
}

export default async function UnsubscribeRequestsPage() {
  await requireAdmin()
  const [open, recent] = await Promise.all([
    prisma.mailingUnsubscribeRequest.findMany({ where: { processedAt: null }, orderBy: { receivedAt: 'asc' } }),
    prisma.mailingUnsubscribeRequest.findMany({ where: { processedAt: { not: null } }, orderBy: { processedAt: 'desc' }, take: 20 }),
  ])
  const people = new Map((await prisma.crmPerson.findMany({
    where: { id: { in: [...open, ...recent].map((r) => r.personId).filter((x): x is string => !!x) } }, select: { id: true, fullName: true },
  })).map((p) => [p.id, p.fullName]))

  return (
    <div className="space-y-6">
      <header>
        <Link href="/support/admin/crm/mailing" className="text-sm text-muted-foreground hover:underline">← Monthly Update and mailing lists</Link>
        <h1 className="text-2xl font-semibold">Process unsubscribes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Replies that said &ldquo;unsubscribe&rdquo; or &ldquo;remove&rdquo;. Processing takes the address off every list. The law gives you 10 business days; anything past 5 days is flagged.
        </p>
      </header>

      {open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing waiting.</p>
      ) : (
        <>
          <form action={processUnsubscribeRequests.bind(null, open.map((r) => r.id))}>
            <SubmitButton pendingLabel="Unsubscribing…">Unsubscribe all {open.length}</SubmitButton>
          </form>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {open.map((r) => {
              const days = businessDaysSince(r.receivedAt)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="font-medium">{r.personId ? <Link href={`/support/admin/crm/people/${r.personId}`} className="hover:underline">{people.get(r.personId)}</Link> : r.email}</span>
                  <span className="text-muted-foreground">{r.email}</span>
                  <span className="max-w-md truncate text-xs text-muted-foreground" title={r.snippet ?? ''}>&ldquo;{r.subject}&rdquo; — {r.snippet}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${days > 5 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                    {days} business {days === 1 ? 'day' : 'days'} ago
                  </span>
                  <form action={processUnsubscribeRequests.bind(null, [r.id])}><SubmitButton size="sm" variant="outline" pendingLabel="…">Unsubscribe</SubmitButton></form>
                  <form action={dismissUnsubscribeRequest.bind(null, r.id)}><SubmitButton size="sm" variant="ghost" pendingLabel="…">Not a request</SubmitButton></form>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recently processed</h2>
          <ul className="text-sm text-muted-foreground">
            {recent.map((r) => (
              <li key={r.id}>{r.email} · {r.processedAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {r.processedBy}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
