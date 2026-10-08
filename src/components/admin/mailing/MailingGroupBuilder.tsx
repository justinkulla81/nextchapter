'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import type { CrmPriorityTier } from '@prisma/client'
import { CrmRolePicker } from '@/components/admin/CrmRolePicker'
import { PRIORITY_TIERS, PRIORITY_TIER_LABELS } from '@/lib/crm/labels'
import { EMPTY_AUDIENCE, isEmptyAudience, type AudienceFilter } from '@/lib/mailing/audience'
import { previewAudience, applyAudience, type AudienceOp } from '@/app/support/admin/(portal)/crm/mailing/actions'
import { MailingListChecklist, type ListOption } from './MailingListChecklist'

type Preview = Awaited<ReturnType<typeof previewAudience>>

/**
 * Add or remove a whole group — by contact type, priority, organization or
 * title — either for one edition only or on the lists themselves. Shows
 * who matches before anything changes, and confirms the count.
 */
export function MailingGroupBuilder({
  editionId,
  lists,
  defaultListIds,
}: {
  /** Set inside the composer; without it only list changes are offered. */
  editionId?: string
  lists: ListOption[]
  defaultListIds: string[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<AudienceFilter>(EMPTY_AUDIENCE)
  const [scope, setScope] = useState<'send' | 'lists'>(editionId ? 'send' : 'lists')
  const [listIds, setListIds] = useState(defaultListIds)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirm, setConfirm] = useState<AudienceOp | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const [loading, setLoading] = useState(false)

  // Re-count shortly after the filter stops changing.
  useEffect(() => {
    if (isEmptyAudience(filter)) return
    let live = true
    const t = setTimeout(async () => {
      setLoading(true)
      const p = await previewAudience(filter)
      if (live) { setPreview(p); setLoading(false) }
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [filter])

  const set = <K extends keyof AudienceFilter>(k: K, v: AudienceFilter[K]) => {
    setFilter((f) => ({ ...f, [k]: v }))
    setConfirm(null)
    setMessage(null)
  }
  const empty = isEmptyAudience(filter)
  const shown = empty ? null : preview
  const n = shown?.total ?? 0

  const run = (op: AudienceOp) => start(async () => {
    const r = await applyAudience({ filter, op, editionId: editionId ?? null, listIds, expected: n })
    posthog.capture('mailing_group_clicked', { op, people: n, editionId: editionId ?? null })
    setMessage({ ok: r.ok, text: r.message })
    setConfirm(null)
    if (r.ok) router.refresh()
  })

  const verb: Record<AudienceOp, string> = {
    add_send: `Add ${n} to this send`,
    remove_send: `Uncheck ${n} for this send`,
    add_lists: `Add ${n} to the ticked lists`,
    remove_lists: `Take ${n} off the ticked lists`,
  }
  const addOp: AudienceOp = scope === 'send' ? 'add_send' : 'add_lists'
  const removeOp: AudienceOp = scope === 'send' ? 'remove_send' : 'remove_lists'
  const field = 'h-8 w-full rounded border border-input bg-transparent px-2 text-sm'

  return (
    <div className={`space-y-3 rounded-lg border border-border p-3 ${pending ? 'cursor-wait' : ''}`}>
      <div>
        <p className="text-sm font-medium">Add or remove a group</p>
        <p className="text-xs text-muted-foreground">Pick any mix; each one narrows the group. Several organizations or titles: separate them with commas.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="text-xs">
          <span className="mb-1 block font-medium">Contact type</span>
          <CrmRolePicker label="Contact type" placeholder="Any type" onToggle={(roles) => set('roles', roles)} />
        </div>
        <div className="text-xs">
          <span className="mb-1 block font-medium">Priority</span>
          <div role="group" aria-label="Priority" className="flex gap-1">
            {PRIORITY_TIERS.map((t) => {
              const on = filter.priorities.includes(t)
              return (
                <button
                  key={t} type="button" aria-pressed={on} title={PRIORITY_TIER_LABELS[t]}
                  onClick={() => set('priorities', on ? filter.priorities.filter((x) => x !== t) : [...filter.priorities, t as CrmPriorityTier])}
                  className={`rounded-md border px-2.5 py-1 ${on ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}
                >
                  {t}
                </button>
              )
            })}
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
            <button key={v} type="button" aria-pressed={scope === v} onClick={() => { setScope(v); setConfirm(null) }}
              className={`rounded-md border px-2.5 py-1 ${scope === v ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      {scope === 'lists' && <MailingListChecklist lists={lists} value={listIds} onChange={setListIds} />}

      {empty ? (
        <p className="text-xs text-muted-foreground">Choose a contact type, priority, organization or title to see who matches.</p>
      ) : loading && !shown ? (
        <p className="text-xs text-muted-foreground">Counting…</p>
      ) : shown ? (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{shown.total.toLocaleString()} {shown.total === 1 ? 'person matches' : 'people match'}</span>
            <span className="text-muted-foreground">
              {' '}· {shown.withEmail.toLocaleString()} with an email address{loading ? ' · updating…' : ''}
            </span>
          </p>
          {shown.sample.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {shown.sample.map((p) => `${p.name}${p.detail ? ` (${p.detail})` : ''}${p.hasEmail ? '' : ' — no email'}`).join('; ')}
              {shown.total > shown.sample.length ? `; and ${shown.total - shown.sample.length} more` : ''}
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
              <button type="button" disabled={n === 0 || (scope === 'lists' && listIds.length === 0)} onClick={() => setConfirm(addOp)}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {verb[addOp]}
              </button>
              <button type="button" disabled={n === 0 || (scope === 'lists' && listIds.length === 0)} onClick={() => setConfirm(removeOp)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                {scope === 'send' ? `Uncheck ${n} for this send` : `Take ${n} off the ticked lists`}
              </button>
              {scope === 'lists' && listIds.length === 0 && <span className="text-xs text-muted-foreground">Tick at least one list.</span>}
              {n === 0 && <span className="text-xs text-muted-foreground">Nobody matches — loosen the filters.</span>}
            </div>
          )}
        </div>
      ) : null}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{message.text}</p>
      )}
    </div>
  )
}
