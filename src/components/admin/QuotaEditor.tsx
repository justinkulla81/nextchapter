'use client'

import { useActionState, useState, useTransition } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { saveQuota, deleteQuota } from '@/app/support/admin/(portal)/crm/outreach/actions'
import { PERSON_GROUPS, PERSON_GROUP_LABEL } from '@/lib/outreach/person-groups'
import { QUOTA_CHANNEL_LABEL, quotaLabel, type QuotaRule } from '@/lib/outreach/touch-stats'

const CHANNEL_KEYS = Object.keys(QUOTA_CHANNEL_LABEL) as QuotaRule['channel'][]

/** Set a weekly target for everyone or one type of person, across all kinds of outreach or one. Setting the same slice again changes it. */
export function QuotaEditor({ rules }: { rules: QuotaRule[] }) {
    const [groupKey, setGroupKey] = useState<string>('ALL')
  const [channel, setChannel] = useState<string>('ALL')
  const [target, setTarget] = useState('')
  // Clear the number once it has saved; on an error it stays so it can be corrected.
  const [state, formAction] = useActionState(async (prev: Awaited<ReturnType<typeof saveQuota>> | null, fd: FormData) => {
    const res = await saveQuota(prev, fd)
    if (res.ok) setTarget('')
    return res
  }, null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [removeMsg, setRemoveMsg] = useState<string | null>(null)
  const [removing, startRemove] = useTransition()

  return (
    <div className={`space-y-4 ${removing ? 'cursor-wait' : ''}`}>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">Who
          <select name="groupKey" value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground">
            <option value="ALL">Everyone</option>
            {PERSON_GROUPS.map((g) => <option key={g} value={g}>{PERSON_GROUP_LABEL[g]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Counting
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground">
            {CHANNEL_KEYS.map((c) => <option key={c} value={c}>{QUOTA_CHANNEL_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Per week
          <input name="weeklyTarget" type="number" inputMode="numeric" min={1} max={10000} value={target} onChange={(e) => setTarget(e.target.value)} className="block w-24 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
        </label>
        <SubmitButton pendingLabel="Saving…" savedLabel="Saved">Save target</SubmitButton>
        <p role="status" aria-live="polite" className={`text-sm ${state && !state.ok ? 'text-destructive' : 'text-success'}`}>{state?.message}</p>
      </form>

      {rules.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-white text-sm">
          {rules.map((r) => {
            const id = `${r.groupKey}:${r.channel}`
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span>{quotaLabel(r)}: <span className="font-medium tabular-nums">{r.weeklyTarget}</span> a week</span>
                {confirming === id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">Remove this target?</span>
                    <button type="button" className="rounded-md border border-border px-2 py-1 font-medium hover:border-navy/40" onClick={() => setConfirming(null)}>Keep it</button>
                    <button type="button" className="rounded-md border border-destructive px-2 py-1 font-medium text-destructive" disabled={removing} onClick={() => startRemove(async () => { const res = await deleteQuota(r.groupKey, r.channel); setRemoveMsg(res.message); setConfirming(null) })}>{removing ? 'Removing…' : 'Yes, remove'}</button>
                  </span>
                ) : (
                  <button type="button" className="font-medium text-primary underline underline-offset-4" onClick={() => { setRemoveMsg(null); setConfirming(id) }}>Remove</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {removeMsg && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{removeMsg}</p>}
    </div>
  )
}
