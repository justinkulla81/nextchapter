import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { nameKey } from '@/lib/conferences/canonical'
import { OPPORTUNITY_LABEL, type OpportunityType } from '@/lib/conferences/constants'
import { approveEntry, mergeEntry, resolveChangeAdmin } from './actions'

export const maxDuration = 30

/** Catalog review: new Quick Add entries, likely duplicates, and changes the weekly re-check found. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ merged?: string; error?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const [pending, changes, all] = await Promise.all([
    prisma.conferenceEvent.findMany({ where: { source: 'quick-add', published: false }, orderBy: { createdAt: 'asc' }, include: { opportunities: { select: { type: true, title: true } }, _count: { select: { editions: true } } }, take: 100 }),
    prisma.conferenceChange.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include: { series: { select: { id: true, name: true } } }, take: 100 }),
    prisma.conferenceEvent.findMany({ select: { id: true, name: true, urlKey: true, published: true } }),
  ]).catch(() => [[], [], []] as const)
  const trackers = pending.length ? await prisma.userConference.groupBy({ by: ['seriesId'], where: { seriesId: { in: pending.map((p) => p.id) } }, _count: { _all: true } }) : []
  const tracked = new Map(trackers.map((t) => [t.seriesId, t._count._all]))

  // Likely duplicates: same name once the year and filler words are removed, or the same home page.
  const groups = new Map<string, typeof all>()
  for (const r of all) {
    const keys = [nameKey(r.name).length >= 6 ? `n:${nameKey(r.name)}` : null, r.urlKey ? `u:${r.urlKey}` : null].filter((k): k is string => !!k)
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1).slice(0, 40)
  const input = 'rounded-md border border-border bg-background px-2 py-1 text-sm'
  const btn = 'rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted'

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Conference catalog review</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Entries members added by link wait here, unpublished. Approve what you have checked, merge duplicates, and confirm what the weekly re-check found.
          Fix tags first in <Link href="/support/admin/crm/events" className="underline">Events</Link>. Only public conference facts are ever shared; members&apos; status and notes never are.
        </p>
        {sp.merged && <p className="text-sm font-medium">{sp.merged === '1' ? 'Merged.' : 'Nothing merged: pick a different event to keep.'}</p>}
        {sp.error === 'merge' && <p className="text-sm text-red-700">To merge, choose the event to keep and tick the confirmation box.</p>}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">New entries ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pending.map((p) => (
            <li key={p.id} className="space-y-2 p-3 text-sm">
              <p><span className="font-medium">{p.name}</span> · {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">{p.url}</a>} · tracked by {tracked.get(p.id) ?? 0}</p>
              <p className="text-muted-foreground">{[...p.industries, ...p.functions].join(', ') || 'No tags'}{p.opportunities.length ? ` · ${p.opportunities.map((o) => OPPORTUNITY_LABEL[o.type as OpportunityType]).join(', ')}` : ''}</p>
              <div className="flex flex-wrap items-center gap-2">
                <form action={approveEntry}><input type="hidden" name="id" value={p.id} /><button className={btn}>Approve and publish</button></form>
                <Link href={`/support/admin/crm/events/${p.id}`} className={btn}>Edit tags</Link>
                <form action={mergeEntry} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="sourceId" value={p.id} />
                  <select name="targetId" defaultValue="" aria-label={`Merge ${p.name} into`} className={input}>
                    <option value="">Merge into…</option>
                    {all.filter((a) => a.id !== p.id).sort((a, b) => a.name.localeCompare(b.name)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="confirm" /> I checked these are the same event</label>
                  <button className={btn}>Merge</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Likely duplicates ({dupes.length})</h2>
        {dupes.length === 0 && <p className="text-sm text-muted-foreground">None found.</p>}
        <ul className="space-y-2">
          {dupes.map((g) => (
            <li key={g.map((x) => x.id).join('|')} className="rounded-lg border border-border p-3 text-sm">
              <p className="mb-2">{g.map((x) => `${x.name}${x.published ? '' : ' (unpublished)'}`).join('  ·  ')}</p>
              <form action={mergeEntry} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1">Merge <select name="sourceId" className={input}>{g.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}</select></label>
                <label className="flex items-center gap-1">into <select name="targetId" defaultValue="" className={input}><option value="">choose…</option>{g.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}</select></label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="confirm" /> I checked these are the same event</label>
                <button className={btn}>Merge</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Changes found by the weekly re-check ({changes.length})</h2>
        {changes.length === 0 && <p className="text-sm text-muted-foreground">Nothing to confirm.</p>}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><span className="font-medium">{c.series.name}</span>: {c.kind.toLowerCase().replace(/_/g, ' ')} · <code className="text-xs">{JSON.stringify(c.payload).slice(0, 160)}</code></span>
              <span className="flex gap-2">
                {([['APPLY', 'Apply'], ['DISMISS', 'Dismiss']] as const).map(([a, l]) => (
                  <form key={a} action={resolveChangeAdmin}><input type="hidden" name="changeId" value={c.id} /><input type="hidden" name="action" value={a} /><button className={btn}>{l}</button></form>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
