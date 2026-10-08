'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import type { CrmPersonRole, CrmPriorityTier } from '@prisma/client'
import { PERSON_ROLES, PERSON_ROLE_LABELS, PRIORITY_TIERS, PRIORITY_TIER_LABELS } from '@/lib/crm/labels'
import { EMAIL_HISTORIES, EMAIL_HISTORY_LABELS, EMPTY_AUDIENCE, isEmptyAudience, type AudienceFilter } from '@/lib/mailing/audience'
import { previewAudience, applyAudience, type AudienceOp } from '@/app/support/admin/(portal)/crm/mailing/actions'
import { MailingListChecklist, type ListOption } from './MailingListChecklist'

type Preview = Awaited<ReturnType<typeof previewAudience>>

const chip = (on: boolean, empty = false) =>
  `rounded-md border px-2.5 py-1 text-left ${on ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'} ${empty && !on ? 'text-muted-foreground' : ''}`
const Count = ({ n }: { n: number | undefined }) => (
  <span className="ml-1 font-normal tabular-nums text-muted-foreground">{n === undefined ? '…' : n.toLocaleString()}</span>
)

/**
 * Add or remove a whole group — by email history, contact type, priority,
 * organization or title — for one edition only or on the lists themselves.
 * Every number counts only people who can be emailed: an address on file
 * and not marked Do not email. Each option shows how many it would give
 * with the other choices kept.
 */
export function MailingGroupBuilder({
  editionId,
  lists,
  defaultListIds,
  skipEarlierVersions = false,
}: {
  /** Set inside the composer; without it only list changes are offered. */
  editionId?: string
  lists: ListOption[]
  defaultListIds: string[]
  /** Version 2 onward with the box ticked: people an earlier version reached go on unchecked. */
  skipEarlierVersions?: boolean
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<AudienceFilter>(EMPTY_AUDIENCE)
  const [scope, setScope] = useState<'send' | 'lists'>(editionId ? 'send' : 'lists')
  const [listIds, setListIds] = useState(defaultListIds)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [confirm, setConfirm] = useState<AudienceOp | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const rolesRef = useRef<HTMLDivElement>(null)

  // Re-count shortly after the filter stops changing (and once on open, for the option counts).
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      setLoading(true)
      const p = await previewAudience(filter, { editionId, skipEarlierVersions })
      if (live) { setPreview(p); setLoading(false) }
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [filter, editionId, skipEarlierVersions])

  useEffect(() => {
    if (!rolesOpen) return
    const close = (e: MouseEvent) => { if (rolesRef.current && !rolesRef.current.contains(e.target as Node)) setRolesOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [rolesOpen])

  const set = <K extends keyof AudienceFilter>(k: K, v: AudienceFilter[K]) => {
    setFilter((f) => ({ ...f, [k]: v }))
    setConfirm(null)
    setMessage(null)
  }
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const empty = isEmptyAudience(filter)
  const facets = preview?.facets
  const n = empty ? 0 : preview?.total ?? 0
  // Only this send is affected by earlier versions; the lists take everyone.
  const leftOutEarlier = scope === 'send' && skipEarlierVersions ? preview?.earlierVersion ?? 0 : 0
  const toAdd = n - leftOutEarlier

  const run = (op: AudienceOp) => start(async () => {
    const r = await applyAudience({ filter, op, editionId: editionId ?? null, listIds, expected: n, skipEarlierVersions })
    posthog.capture('mailing_group_clicked', { op, people: n, editionId: editionId ?? null, history: filter.history })
    setMessage({ ok: r.ok, text: r.message })
    setConfirm(null)
    if (r.ok) { router.refresh(); setPreview(await previewAudience(filter, { editionId, skipEarlierVersions })) }
  })

  const verb: Record<AudienceOp, string> = {
    add_send: `Add ${toAdd} to this send`,
    remove_send: `Uncheck ${n} for this send`,
    add_lists: `Add ${n} to the ticked lists`,
    remove_lists: `Take ${n} off the ticked lists`,
  }
  const addOp: AudienceOp = scope === 'send' ? 'add_send' : 'add_lists'
  const removeOp: AudienceOp = scope === 'send' ? 'remove_send' : 'remove_lists'
  const field = 'h-8 w-full rounded border border-input bg-transparent px-2 text-sm'
  const sortedRoles = [...PERSON_ROLES].sort((a, b) => (facets?.roles[b] ?? 0) - (facets?.roles[a] ?? 0))

  return (
    <div className={`space-y-3 rounded-lg border border-border p-3 ${pending ? 'cursor-wait' : ''}`}>
      <div>
        <p className="text-sm font-medium">Add or remove a group</p>
        <p className="text-xs text-muted-foreground">
          Only people with an email address are counted or added; anyone marked Do not email is left out. Each choice narrows the group;
          the number next to an option is how many you&apos;d get with it.
        </p>
      </div>

      {/* Email history: four options, so adjacent buttons. */}
      <div className="text-xs">
        <span className="mb-1 block font-medium">Email history with you</span>
        <div role="group" aria-label="Email history" className="flex flex-wrap gap-1">
          {EMAIL_HISTORIES.map((h) => (
            <button key={h} type="button" aria-pressed={filter.history === h} onClick={() => set('history', h)} className={chip(filter.history === h, facets?.history[h] === 0)}>
              {EMAIL_HISTORY_LABELS[h]}<Count n={facets?.history[h]} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Contact type: 19 options, so a list that opens, with counts. */}
        <div className="relative text-xs" ref={rolesRef}>
          <span className="mb-1 block font-medium">Contact type</span>
          <button type="button" aria-expanded={rolesOpen} onClick={() => setRolesOpen((o) => !o)} className="flex h-8 w-full items-center justify-between rounded border border-input px-2 text-left text-sm">
            <span className="truncate">{filter.roles.length ? filter.roles.map((r) => PERSON_ROLE_LABELS[r]).join(', ') : 'Any type'}</span>
            <span aria-hidden className="ml-1 text-muted-foreground">▾</span>
          </button>
          {rolesOpen && (
            <div className="absolute z-20 mt-1 max-h-80 w-72 overflow-auto rounded-lg border border-border bg-background p-1 shadow-lg">
              {sortedRoles.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted ${(facets?.roles[r] ?? 0) === 0 ? 'text-muted-foreground' : ''}`}>
                  <input type="checkbox" checked={filter.roles.includes(r)} onChange={() => set('roles', toggle<CrmPersonRole>(filter.roles, r))} />
                  <span className="flex-1">{PERSON_ROLE_LABELS[r]}</span>
                  <span className="tabular-nums text-muted-foreground">{facets?.roles[r]?.toLocaleString() ?? '…'}</span>
                </label>
              ))}
              {filter.roles.length > 0 && (
                <button type="button" onClick={() => set('roles', [])} className="mt-1 w-full rounded px-2 py-1 text-left text-muted-foreground underline">Clear contact types</button>
              )}
            </div>
          )}
        </div>
        <div className="text-xs">
          <span className="mb-1 block font-medium">Priority</span>
          <div role="group" aria-label="Priority" className="flex gap-1">
            {PRIORITY_TIERS.map((t) => (
              <button key={t} type="button" aria-pressed={filter.priorities.includes(t)} title={PRIORITY_TIER_LABELS[t]}
                onClick={() => set('priorities', toggle<CrmPriorityTier>(filter.priorities, t))} className={chip(filter.priorities.includes(t), facets?.priorities[t] === 0)}>
                {t}<Count n={facets?.priorities[t]} />
              </button>
            ))}
          </div>
        </div>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Organization</span>
          <input value={filter.orgs} onChange={(e) => set('orgs', e.target.value)} placeholder="e.g. Google, Microsoft" className={field} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium">Title</span>
          <input value={filter.titles} onChange={(e) => set('titles', e.target.value)} placeholder="e.g. CHRO, VP People" className={field} />
        </label>
      </div>

      {editionId && (
        <div role="group" aria-label="Where" className="flex flex-wrap items-center gap-1 text-xs">
          <span className="mr-1 font-medium">Change</span>
          {([['send', 'This send only'], ['lists', 'The lists (future sends too)']] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={scope === v} onClick={() => { setScope(v); setConfirm(null) }} className={chip(scope === v)}>{l}</button>
          ))}
        </div>
      )}
      {scope === 'lists' && <MailingListChecklist lists={lists} value={listIds} onChange={setListIds} />}

      {empty ? (
        <p className="text-xs text-muted-foreground">Pick an email history, contact type, priority, organization or title to see who&apos;s in the group.</p>
      ) : !preview || (loading && preview.total === undefined) ? (
        <p className="text-xs text-muted-foreground">Counting…</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{n.toLocaleString()} {n === 1 ? 'person' : 'people'} with an email address</span>
            {leftOutEarlier > 0 && <span className="text-muted-foreground"> · {leftOutEarlier} already got an earlier version and go on unchecked</span>}
            {preview.doNotEmail > 0 && <span className="text-muted-foreground"> · {preview.doNotEmail} marked Do not email left out</span>}
            {loading && <span className="text-muted-foreground"> · updating…</span>}
          </p>
          {preview.sample.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.sample.map((p) => `${p.name}${p.detail ? ` (${p.detail})` : ''}`).join('; ')}
              {n > preview.sample.length ? `; and ${n - preview.sample.length} more` : ''}
            </p>
          )}
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand/40 bg-brand/5 px-3 py-2 text-sm">
              <span>{verb[confirm]}?</span>
              <button type="button" disabled={pending} onClick={() => run(confirm)} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white">
                {pending ? 'Working…' : 'Yes'}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-border px-3 py-1 text-xs">Cancel</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={(addOp === 'add_send' ? toAdd : n) === 0 || (scope === 'lists' && listIds.length === 0)} onClick={() => setConfirm(addOp)}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {verb[addOp]}
              </button>
              <button type="button" disabled={n === 0 || (scope === 'lists' && listIds.length === 0)} onClick={() => setConfirm(removeOp)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                {verb[removeOp]}
              </button>
              {scope === 'lists' && listIds.length === 0 && <span className="text-xs text-muted-foreground">Tick at least one list.</span>}
              {n === 0 && <span className="text-xs text-muted-foreground">Nobody with an email address matches — loosen the choices.</span>}
            </div>
          )}
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message.text}</p>
      )}
    </div>
  )
}
