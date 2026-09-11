'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Fact { label: string; value: string }
interface Peek {
  kind: 'person' | 'org'
  id: string
  title: string
  subtitle: string | null
  href: string
  roles?: string[]
  facts: Fact[]
  body: string | null
  linkedinUrl?: string | null
  activities?: { subject: string; when: string; auto: boolean }[]
  people?: { id: string; name: string; detail: string | null; touched: string }[]
  pipelines?: { label: string; stage: string }[]
  paths?: { via: string; strength: string; status: string }[]
  dates?: { label: string; value: string }[]
}

/**
 * Slide-over summary, opened from a list row.
 *
 * "Who is this again" is the most common thing you do with a list, and it
 * should not cost a navigation plus a re-render of a 100-row table. The full
 * record page still exists and this links to it; the panel just answers the
 * quick question in place.
 */
export function CrmPeekPanel() {
  const [data, setData] = useState<Peek | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    async function open(e: Event) {
      const detail = (e as CustomEvent<{ id: string; kind: 'person' | 'org' }>).detail
      lastFocused.current = document.activeElement as HTMLElement
      setLoading(true); setError(null); setData(null)
      try {
        const res = await fetch(`/support/admin/crm/peek?id=${detail.id}&kind=${detail.kind}`)
        if (!res.ok) throw new Error(String(res.status))
        setData(await res.json())
      } catch {
        setError('Could not load that record. Open the full page instead.')
      } finally {
        setLoading(false)
      }
    }
    window.addEventListener('crm:peek', open)
    return () => window.removeEventListener('crm:peek', open)
  }, [])

  useEffect(() => {
    if (data || loading) closeRef.current?.focus()
  }, [data, loading])

  function close() {
    setData(null); setLoading(false); setError(null)
    lastFocused.current?.focus()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const open = loading || Boolean(data) || Boolean(error)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Record summary">
      <button type="button" aria-label="Close summary" onClick={close} className="flex-1 bg-black/20" />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{data?.title ?? (loading ? 'Loading…' : 'Record')}</h2>
            {data?.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{data.subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 p-4 text-sm">
          {loading && <p className="text-muted-foreground">Loading…</p>}
          {error && <p className="text-destructive">{error}</p>}

          {data && (
            <>
              {data.roles && data.roles.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {data.roles.map((r) => <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs">{r}</span>)}
                </p>
              )}

              <dl className="grid grid-cols-2 gap-3">
                {data.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="mt-0.5 break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>

              {data.body && <p className="text-muted-foreground">{data.body}</p>}

              {data.paths && data.paths.length > 0 && (
                <Block title="Routes in">
                  {data.paths.map((p, i) => (
                    <li key={i}>{p.via} <span className="text-xs text-muted-foreground">{p.strength.toLowerCase()} · {p.status.toLowerCase().replace('_', ' ')}</span></li>
                  ))}
                </Block>
              )}

              {data.people && data.people.length > 0 && (
                <Block title="People there">
                  {data.people.map((p) => (
                    <li key={p.id}>
                      <Link href={`/support/admin/crm/people/${p.id}`} className="hover:underline">{p.name}</Link>
                      {p.detail && <span className="text-xs text-muted-foreground"> — {p.detail}</span>}
                      <span className="ml-1 text-xs text-muted-foreground">· {p.touched}</span>
                    </li>
                  ))}
                </Block>
              )}

              {data.pipelines && data.pipelines.length > 0 && (
                <Block title="Pipelines">
                  {data.pipelines.map((p, i) => <li key={i}>{p.label} <span className="text-xs text-muted-foreground">· {p.stage}</span></li>)}
                </Block>
              )}

              {data.dates && data.dates.length > 0 && (
                <Block title="Dates">
                  {data.dates.map((d, i) => <li key={i}>{d.label} <span className="text-xs text-muted-foreground">· {d.value}</span></li>)}
                </Block>
              )}

              {data.activities && data.activities.length > 0 && (
                <Block title="Recent activity">
                  {data.activities.map((a, i) => (
                    <li key={i}>{a.subject} <span className="text-xs text-muted-foreground">· {a.when}{a.auto ? ' · auto' : ''}</span></li>
                  ))}
                </Block>
              )}
              {data.activities && data.activities.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing logged against this record yet.</p>
              )}
            </>
          )}
        </div>

        {data && (
          <div className="flex flex-wrap gap-2 border-t border-border p-4">
            <Link href={data.href} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Open full record
            </Link>
            {data.linkedinUrl && (
              <a href={data.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                LinkedIn
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      <ul className="mt-1 space-y-1">{children}</ul>
    </div>
  )
}

/** Opens the panel. A plain button so it is keyboard-reachable like any link. */
export function CrmPeekButton({
  id, kind, children, className,
}: {
  id: string
  kind: 'person' | 'org'
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('crm:peek', { detail: { id, kind } }))}
      className={className ?? 'text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-brand'}
    >
      {children}
    </button>
  )
}
