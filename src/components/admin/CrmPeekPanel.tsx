'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  updatePersonField, logCallWithFollowUp, clearPersonFollowUp,
} from '@/app/support/admin/(portal)/crm/actions'
import { QUALITY_LABELS, WARMTH_LABELS, PRIORITY_TIER_LABELS, QUALITIES, WARMTHS, PRIORITY_TIERS } from '@/lib/crm/labels'

interface Fact { label: string; value: string }
interface Peek {
  kind: 'person' | 'org'
  id: string
  title: string
  subtitle: string | null
  href: string
  roles?: string[]
  editable?: { leadQuality: string; warmth: string; priority: string | null }
  company?: { id: string; name: string; otherPeopleCount: number } | null
  facts: Fact[]
  body: string | null
  linkedinUrl?: string | null
  followUp?: { dueAt: string; note: string | null } | null
  activities?: { subject: string; when: string; auto: boolean; body?: string | null }[]
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
 * quick question in place — and, for a person, lets you act on it in place
 * too (edit quality/warmth/priority, log a call, set a follow-up) rather
 * than needing the full page for every small update.
 */
export function CrmPeekPanel() {
  const [data, setData] = useState<Peek | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  function refetch(id: string, kind: 'person' | 'org') {
    fetch(`/support/admin/crm/peek?id=${id}&kind=${kind}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }

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
            {data?.linkedinUrl && (
              <a href={data.linkedinUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-sm text-primary underline underline-offset-4">
                LinkedIn
              </a>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
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

              {data.company !== undefined && (
                <div>
                  {data.company ? (
                    <p>
                      <Link href={`/support/admin/crm/organizations/${data.company.id}`} className="font-medium text-primary underline underline-offset-4">
                        {data.company.name}
                      </Link>
                      {data.company.otherPeopleCount > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · {data.company.otherPeopleCount} other {data.company.otherPeopleCount === 1 ? 'person' : 'people'} here
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No organization on file.</p>
                  )}
                </div>
              )}

              {data.editable && (
                <EditableFields personId={data.id} editable={data.editable} onSaved={() => refetch(data.id, 'person')} />
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

              {data.followUp !== undefined && (
                <FollowUpBlock personId={data.id} followUp={data.followUp} onChanged={() => refetch(data.id, 'person')} />
              )}

              {data.kind === 'person' && (
                <LogCallForm personId={data.id} onLogged={() => refetch(data.id, 'person')} />
              )}

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
                <Block title="Recent activity — email correspondence and more">
                  {data.activities.map((a, i) => <ActivityRow key={i} activity={a} />)}
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
          </div>
        )}
      </aside>
    </div>
  )
}

function ActivityRow({ activity }: { activity: { subject: string; when: string; auto: boolean; body?: string | null } }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      {activity.body ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-left hover:underline">
          {activity.subject}
        </button>
      ) : (
        activity.subject
      )}
      <span className="text-xs text-muted-foreground"> · {activity.when}{activity.auto ? ' · auto' : ''}</span>
      {open && activity.body && (
        <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{activity.body}</p>
      )}
    </li>
  )
}

function EditableFields({
  personId, editable, onSaved,
}: {
  personId: string
  editable: { leadQuality: string; warmth: string; priority: string | null }
  onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const save = (field: 'leadQuality' | 'warmth' | 'priority', value: string) => {
    start(async () => { await updatePersonField(personId, field, value); onSaved() })
  }
  return (
    <div className={`grid grid-cols-3 gap-2 ${pending ? 'cursor-progress opacity-60' : ''}`}>
      <label className="text-xs text-muted-foreground">
        Quality
        <select defaultValue={editable.leadQuality} onChange={(e) => save('leadQuality', e.target.value)} className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-1 text-sm">
          {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Warmth
        <select defaultValue={editable.warmth} onChange={(e) => save('warmth', e.target.value)} className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-1 text-sm">
          {WARMTHS.map((w) => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Priority
        <select defaultValue={editable.priority ?? ''} onChange={(e) => save('priority', e.target.value)} className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-1 text-sm">
          <option value="">None</option>
          {PRIORITY_TIERS.map((t) => <option key={t} value={t}>{PRIORITY_TIER_LABELS[t]}</option>)}
        </select>
      </label>
    </div>
  )
}

function FollowUpBlock({
  personId, followUp, onChanged,
}: {
  personId: string
  followUp: { dueAt: string; note: string | null } | null
  onChanged: () => void
}) {
  const [pending, start] = useTransition()
  if (!followUp) return null
  return (
    <div className="rounded-lg border border-orange/40 bg-orange/5 p-3">
      <p className="text-xs font-semibold text-orange">Follow up {followUp.dueAt}</p>
      {followUp.note && <p className="mt-1 text-xs text-muted-foreground">{followUp.note}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await clearPersonFollowUp(personId); onChanged() })}
        className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Mark done
      </button>
    </div>
  )
}

function LogCallForm({ personId, onLogged }: { personId: string; onLogged: () => void }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-primary underline underline-offset-4">
        + Log a call
      </button>
    )
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      action={(fd) => start(async () => { await logCallWithFollowUp(personId, fd); setOpen(false); onLogged() })}
    >
      <p className="text-sm font-medium">Log a call</p>
      <label className="block text-xs text-muted-foreground">
        When
        <input type="datetime-local" name="occurredAt" className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-2 text-sm" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Notes
        <textarea name="note" rows={2} className="mt-0.5 block w-full rounded border border-input bg-transparent px-2 py-1 text-sm" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Follow up on <span className="text-muted-foreground/70">(optional)</span>
        <input type="date" name="followUpAt" className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-2 text-sm" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
    </form>
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
