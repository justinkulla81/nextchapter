'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  updatePersonField, logCallWithFollowUp, clearPersonFollowUp,
} from '@/app/support/admin/(portal)/crm/actions'
import { QUALITY_LABELS, WARMTH_LABELS, QUALITIES, WARMTHS, PRIORITY_TIERS } from '@/lib/crm/labels'
import { CrmInlineRoles } from '@/components/admin/CrmInlineRoles'
import { CrmInlineGoals } from '@/components/admin/CrmInlineGoals'
import { CrmInlineText } from '@/components/admin/CrmInlineText'
import { CrmEmailBackfillPrompt } from '@/components/admin/CrmEmailBackfillPrompt'
import { CrmNextChapterAccount, type NextChapterAccountInfo } from '@/components/admin/CrmNextChapterAccount'
import type { CrmPersonRole, CrmGoal } from '@prisma/client'

interface Fact { label: string; value: string }
interface Activity {
  subject: string; when: string; auto: boolean; body?: string | null; isProfileChange?: boolean
  thread?: string | null; direction?: string
}
interface Peek {
  kind: 'person' | 'org'
  id: string
  title: string
  subtitle: string | null
  href: string
  roles?: CrmPersonRole[]
  goals?: CrmGoal[]
  email?: string | null
  phone?: string | null
  location?: string | null
  rapSheet?: { href: string; label: string } | null
  awaitingReply?: boolean
  meeting?: string | null
  nextChapter?: NextChapterAccountInfo
  editable?: { leadQuality: string; warmth: string; priority: string | null }
  company?: { id: string; name: string; otherPeopleCount: number } | null
  facts: Fact[]
  body: string | null
  linkedinUrl?: string | null
  followUp?: { dueAt: string | null; note: string | null } | null
  activities?: Activity[]
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
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
              {data?.linkedinUrl && (
                <a href={data.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">LinkedIn</a>
              )}
              {data?.rapSheet && (
                <Link href={data.rapSheet.href} className="text-primary underline underline-offset-4" title={data.rapSheet.label}>Meeting Prep</Link>
              )}
            </div>
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
              {data.kind === 'person' && data.roles && (
                <CrmInlineRoles personId={data.id} roles={data.roles} name={data.title} onSaved={() => refetch(data.id, 'person')} />
              )}

              {data.company !== undefined && (
                <div>
                  {data.company ? (
                    <p>
                      <Link href={`/support/admin/crm/organizations/${data.company.id}`} className="font-medium text-primary underline underline-offset-4">
                        {data.company.name}
                      </Link>
                      {data.company.otherPeopleCount > 0 && (
                        <span className="ml-1.5 text-muted-foreground">
                          · {data.company.otherPeopleCount} other {data.company.otherPeopleCount === 1 ? 'person' : 'people'} here
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No organization on file.</p>
                  )}
                </div>
              )}

              {data.editable && (
                <EditableFields personId={data.id} editable={data.editable} onSaved={() => refetch(data.id, 'person')} />
              )}

              {data.kind === 'person' && data.goals !== undefined && (
                <Field label="Goal">
                  <CrmInlineGoals size="md" personId={data.id} goals={data.goals} name={data.title} onSaved={() => refetch(data.id, 'person')} />
                </Field>
              )}

              {data.kind === 'person' && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  {data.email !== undefined && (
                    <Field label="Email" className="min-w-0 break-words">
                      <CrmEmailBackfillPrompt personId={data.id} email={data.email} />
                    </Field>
                  )}
                  <Field label="Phone">
                    {data.phone ? <a href={`tel:${data.phone}`} className="text-muted-foreground underline underline-offset-2">{data.phone}</a> : <span className="text-muted-foreground">—</span>}
                  </Field>
                  {data.location !== undefined && (
                    <Field label="Location">
                      <CrmInlineText size="md" personId={data.id} field="location" value={data.location ?? ''} label={`Location for ${data.title}`} placeholder="Add a location" onSaved={() => refetch(data.id, 'person')} />
                    </Field>
                  )}
                  {data.nextChapter && (
                    <CrmNextChapterAccount variant="field" info={data.nextChapter} onChanged={() => refetch(data.id, 'person')} />
                  )}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3">
                {data.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="mt-0.5 break-words">
                      {f.value}
                      {f.label === 'Last contacted' && (data.meeting ? (
                        <MeetingChip meeting={data.meeting} href={data.rapSheet?.href} />
                      ) : data.awaitingReply && (
                        <span className="ml-1.5 inline-block rounded-full bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-orange">
                          Waiting on them
                        </span>
                      ))}
                    </dd>
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

              {data.activities && data.activities.length > 0 && (() => {
                const interactions = data.activities!.filter((a) => !a.isProfileChange)
                const profileChanges = data.activities!.filter((a) => a.isProfileChange)
                return (
                  <>
                    {interactions.length > 0 && (
                      <Block title="Interaction activity — calls, email, meetings">
                        {groupThreads(interactions).map((g, i) => g.length > 1 ? <ThreadRow key={i} messages={g} /> : <ActivityRow key={i} activity={g[0]} />)}
                      </Block>
                    )}
                    {profileChanges.length > 0 && (
                      <Block title="Profile activity — record edits">
                        {profileChanges.map((a, i) => <ActivityRow key={i} activity={a} />)}
                      </Block>
                    )}
                  </>
                )
              })()}
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
  const select = 'block h-8 w-full rounded border border-input bg-transparent px-1.5 text-sm'
  return (
    <div className={`grid grid-cols-3 gap-3 ${pending ? 'cursor-progress opacity-60' : ''}`}>
      <Field label="Priority" as="label">
        <select key={editable.priority ?? ''} defaultValue={editable.priority ?? ''} onChange={(e) => save('priority', e.target.value)} className={select}>
          {!editable.priority && <option value="">—</option>}
          {PRIORITY_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Quality" as="label">
        <select key={editable.leadQuality} defaultValue={editable.leadQuality} onChange={(e) => save('leadQuality', e.target.value)} className={select}>
          {QUALITIES.map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
        </select>
      </Field>
      <Field label="Warmth" as="label">
        <select key={editable.warmth} defaultValue={editable.warmth} onChange={(e) => save('warmth', e.target.value)} className={select}>
          {WARMTHS.map((w) => <option key={w} value={w}>{WARMTH_LABELS[w]}</option>)}
        </select>
      </Field>
    </div>
  )
}

/** Label above a value — the one label/value shape the whole panel uses. */
function Field({ label, children, className, as }: { label: string; children: React.ReactNode; className?: string; as?: 'label' }) {
  const Tag = as ?? 'div'
  return (
    <Tag className={`block ${className ?? ''}`}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <div className="mt-0.5 text-sm">{children}</div>
    </Tag>
  )
}

function MeetingChip({ meeting, href }: { meeting: string; href?: string }) {
  const cls = 'ml-1.5 inline-block rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand'
  return href
    ? <Link href={href} className={`${cls} underline underline-offset-2`} title="Open the Meeting Prep">Meeting scheduled · {meeting}</Link>
    : <span className={cls}>Meeting scheduled · {meeting}</span>
}

/** Consecutive-or-not, messages in one thread collapse into a group placed where the newest one sits. */
function groupThreads(items: Activity[]): Activity[][] {
  const groups: Activity[][] = []
  const byThread = new Map<string, Activity[]>()
  for (const a of items) {
    const g = a.thread ? byThread.get(a.thread) : undefined
    if (g) { g.push(a); continue }
    const ng = [a]
    groups.push(ng)
    if (a.thread) byThread.set(a.thread, ng)
  }
  return groups
}

function ThreadRow({ messages }: { messages: Activity[] }) {
  const [open, setOpen] = useState(false)
  const title = messages[0].subject.replace(/^(\s*(re|fwd?)\s*:\s*)+/i, '')
  const first = messages[messages.length - 1]
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-left hover:underline">
        {title}
      </button>
      <span className="text-xs text-muted-foreground"> · {messages.length} emails · {messages[0].when}{first.when !== messages[0].when ? ` back to ${first.when}` : ''}</span>
      {open && (
        <ul className="mt-1 space-y-1 border-l border-border pl-3">
          {messages.map((m, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              {m.when} · {m.direction === 'INBOUND' ? 'from them' : 'from you'}{m.auto ? ' · auto' : ''}
              {m.body && <p className="mt-0.5 whitespace-pre-wrap rounded-md bg-muted/50 p-2">{m.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function FollowUpBlock({
  personId, followUp, onChanged,
}: {
  personId: string
  followUp: { dueAt: string | null; note: string | null } | null
  onChanged: () => void
}) {
  const [pending, start] = useTransition()
  if (!followUp) return null
  return (
    <div className="rounded-lg border border-orange/40 bg-orange/5 p-3">
      <p className="text-xs font-semibold text-orange">{followUp.dueAt ? `Follow up ${followUp.dueAt}` : 'Follow up — no date set'}</p>
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
        <input type="date" name="occurredAt" className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-2 text-sm" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Notes
        <textarea name="note" rows={2} className="mt-0.5 block w-full rounded border border-input bg-transparent px-2 py-1 text-sm" />
      </label>
      <div className="rounded border border-input p-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" name="needsFollowUp" />
          Needs a follow-up
        </label>
        <label className="mt-1.5 block text-xs text-muted-foreground">
          On <span className="text-muted-foreground/70">(optional — leave blank if you don&apos;t know yet)</span>
          <input type="date" name="followUpAt" className="mt-0.5 block h-8 w-full rounded border border-input bg-transparent px-2 text-sm" />
        </label>
      </div>
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
