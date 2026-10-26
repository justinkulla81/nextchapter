import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { addLocalEvent, setLocalEventPublished } from './actions'

export const maxDuration = 30

const yesterday = () => new Date(Date.now() - 86_400_000)
const when = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

/**
 * Local job fairs, hiring events and entrepreneurship events (read weekly by scripts/local-events). Hide a bad one, show it again,
 * or add one the crawler cannot see. Hand-set rows are locked, so the crawl never changes them.
 */
export default async function CrmLocalEventsPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string; show?: string; added?: string; error?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const state = ALL_STATE_CODES.find((c) => c === sp.state)
  const q = sp.q?.slice(0, 80)
  const show = sp.show === 'hidden' ? 'hidden' : 'live'
  const now = yesterday()
  const [rows, bySource, totals] = await Promise.all([
    prisma.localEvent.findMany({
      where: { startsAt: { gte: now }, published: show === 'live', ...(state ? { state } : {}), ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}) },
      orderBy: { startsAt: 'asc' }, take: 200,
      select: { id: true, title: true, kind: true, startsAt: true, city: true, state: true, url: true, locked: true, sourceType: true, links: { where: { role: 'HOST' }, select: { targetName: true, targetKind: true }, take: 1 } },
    }),
    prisma.$queryRaw<{ kind: string; sources: number; withEvents: number; events: number }[]>`
      select kind, count(*)::int as sources, count(*) filter (where "eventCount" > 0)::int as "withEvents", coalesce(sum("eventCount"), 0)::int as events from "LocalEventSource" group by 1 order by 2 desc`,
    prisma.localEvent.groupBy({ by: ['published'], where: { startsAt: { gte: now } }, _count: { _all: true } }),
  ])
  const live = totals.find((t) => t.published)?._count._all ?? 0
  const hidden = totals.find((t) => !t.published)?._count._all ?? 0
  const field = 'h-9 rounded-md border border-border bg-white px-3 text-sm'
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Local events</h1>
        <p className="mt-1 text-sm text-muted-foreground">{live.toLocaleString()} upcoming and shown, {hidden.toLocaleString()} hidden by hand. Public pages: <Link href="/events" className="underline">/events</Link>. Conferences and trade shows are <Link href="/support/admin/crm/events" className="underline">here</Link>.</p>
      </div>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-semibold">Sources read each week</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Kind</th><th>Sites</th><th>With events</th><th>Events found</th></tr></thead>
          <tbody>{bySource.map((s) => <tr key={s.kind} className="border-t border-border"><td className="py-1">{s.kind}</td><td>{s.sources}</td><td>{s.withEvents}</td><td>{s.events}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-semibold">Add an event</h2>
        {sp.added && <p className="mt-1 text-sm text-green-700">Added.</p>}
        {sp.error && <p className="mt-1 text-sm text-red-700">Title, a valid date and a valid state are needed.</p>}
        <form action={addLocalEvent} className="mt-3 flex flex-wrap items-end gap-2">
          <input name="title" placeholder="Title" required className={`${field} w-72`} />
          <input name="startsAt" type="date" required className={field} />
          <input name="city" placeholder="City" className={`${field} w-36`} />
          <input name="state" placeholder="ST" maxLength={2} className={`${field} w-16 uppercase`} />
          <input name="url" placeholder="https://…" className={`${field} w-64`} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="online" /> Online</label>
          <button className="h-9 rounded-md bg-ink px-4 text-sm font-semibold text-white">Add</button>
        </form>
      </section>

      <section>
        <form className="mb-3 flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Search title" className={`${field} w-60`} />
          <select name="state" defaultValue={state ?? ''} className={field}><option value="">All states</option>{ALL_STATE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select name="show" defaultValue={show} className={field}><option value="live">Shown</option><option value="hidden">Hidden</option></select>
          <button className="h-9 rounded-md border border-border px-4 text-sm">Filter</button>
        </form>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">When</th><th>Event</th><th>Where</th><th>Host</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="py-2 whitespace-nowrap">{when(r.startsAt)}</td>
                <td className="py-2 pr-3">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.title}</a> : r.title}<div className="text-xs text-muted-foreground">{r.kind}{r.locked ? ' · locked' : ''} · {r.sourceType}</div></td>
                <td className="py-2">{[r.city, r.state].filter(Boolean).join(', ') || 'Online'}</td>
                <td className="py-2">{r.links[0]?.targetName ?? ''}</td>
                <td className="py-2">
                  <form action={setLocalEventPublished}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="published" value={show === 'live' ? '0' : '1'} />
                    <button className="rounded border border-border px-2 py-1 text-xs">{show === 'live' ? 'Hide' : 'Show'}</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nothing matches.</td></tr>}
          </tbody>
        </table>
        {rows.length === 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200; narrow with the filters.</p>}
      </section>
    </div>
  )
}
