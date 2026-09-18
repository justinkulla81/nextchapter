'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { restoreRemovedPeople } from '@/app/support/admin/(portal)/crm/actions'
import { priorityTierClass } from '@/lib/crm/labels'

export interface RemovedRow {
  id: string
  name: string
  email: string | null
  org: string | null
  title: string | null
  priority: 'P0' | 'P1' | 'P2' | null
  removedAt: string
  touches: number
  lastTouchedAt: string | null
  mergedInto: string | null
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

/**
 * Removed people, grouped by the moment they were removed.
 *
 * A bulk removal lands every row on the same timestamp, so each group is one
 * decision — and gets one button to undo it. Individual rows and a ticked
 * selection restore too. Merged duplicates are listed for completeness but
 * can't be restored: they'd come back as a second copy of someone live.
 */
export function CrmRemovedList({ rows }: { rows: RemovedRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ restored: number; skipped: { name: string; reason: string }[] } | null>(null)

  const groups = useMemo(() => {
    const byStamp = new Map<string, RemovedRow[]>()
    for (const r of rows) {
      const key = r.removedAt.slice(0, 19) // to the second
      const list = byStamp.get(key) ?? []
      list.push(r)
      byStamp.set(key, list)
    }
    return [...byStamp.entries()].map(([key, list]) => ({ key, list }))
  }, [rows])

  function restore(ids: string[]) {
    const restorable = ids.filter((id) => !rows.find((r) => r.id === id)?.mergedInto)
    if (restorable.length === 0) return
    setResult(null)
    start(async () => {
      const res = await restoreRemovedPeople(restorable)
      setResult({ restored: res.restored.length, skipped: res.skipped.map((s) => ({ name: s.name, reason: s.reason })) })
      setSelected(new Set())
      router.refresh()
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nobody matches — no one removed fits this search.
      </p>
    )
  }

  return (
    <div className={`space-y-4 ${pending ? 'cursor-progress' : ''}`}>
      {result && (
        <div role="status" className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
          <p className="font-medium">
            Restored {result.restored} {result.restored === 1 ? 'person' : 'people'}.
            {result.skipped.length > 0 && ` Held back ${result.skipped.length}:`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {result.skipped.slice(0, 20).map((s) => <li key={s.name + s.reason}>{s.name} — {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            type="button" disabled={pending} onClick={() => restore([...selected])}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Restoring…' : `Restore ${selected.size}`}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground underline">
            Clear selection
          </button>
        </div>
      )}

      {groups.map(({ key, list }) => {
        const restorable = list.filter((r) => !r.mergedInto)
        const withHistory = list.filter((r) => r.touches > 0).length
        return (
          <section key={key} className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-sm">
                <span className="font-medium">Removed {stamp(key)}</span>
                <span className="text-muted-foreground">
                  {' '}· {list.length} {list.length === 1 ? 'person' : 'people'}
                  {withHistory > 0 && ` · ${withHistory} with contact history`}
                </span>
              </p>
              {restorable.length > 1 && (
                <button
                  type="button" disabled={pending} onClick={() => restore(restorable.map((r) => r.id))}
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                >
                  Restore all {restorable.length}
                </button>
              )}
            </header>
            <ul className="divide-y divide-border">
              {list.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox" aria-label={`Select ${r.name}`} disabled={Boolean(r.mergedInto)}
                    checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium">{r.name}</span>
                      {r.priority && (
                        <span className={`rounded px-1 text-xs font-semibold ${priorityTierClass(r.priority)}`}>{r.priority}</span>
                      )}
                      {r.touches > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {r.touches} {r.touches === 1 ? 'contact' : 'contacts'}
                          {r.lastTouchedAt && `, last ${new Date(r.lastTouchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[r.title, r.org, r.email].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {r.mergedInto ? (
                    <span className="shrink-0 text-xs text-muted-foreground">Merged into {r.mergedInto}</span>
                  ) : (
                    <button
                      type="button" disabled={pending} onClick={() => restore([r.id])}
                      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
