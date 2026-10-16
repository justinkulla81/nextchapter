'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { addMandate, removeMandate, setMandateStatus } from '@/app/support/admin/(portal)/crm/mandate-actions'
import { MANDATE_STATUSES, MANDATE_STATUS_LABELS, type MandateStatusKey } from '@/lib/crm/mandates'

export interface MandateRow {
  id: string
  orgId: string
  orgName: string
  scope: string | null
  status: MandateStatusKey
}

const field = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

/** Adjacent buttons for the three statuses; the selected one is filled. */
function StatusButtons({ value, onChange, disabled, label }: { value: MandateStatusKey; onChange: (s: MandateStatusKey) => void; disabled?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1">
      {MANDATE_STATUSES.map((s) => (
        <button
          key={s} type="button" disabled={disabled} aria-pressed={value === s} onClick={() => onChange(s)}
          className={`h-7 rounded-md border px-2 text-xs ${value === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
        >
          {MANDATE_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

function MandateItem({ m }: { m: MandateRow }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const run = (fn: () => ReturnType<typeof removeMandate>) =>
    start(async () => {
      const r = await fn()
      setError(r.ok ? '' : r.error)
      setConfirming(false)
    })
  return (
    <li className={`space-y-2 p-3 text-sm ${pending ? 'cursor-progress' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Link href={`/support/admin/crm/organizations/${m.orgId}`} className="font-medium hover:underline">{m.orgName}</Link>
          {m.scope && <span className="text-muted-foreground"> — {m.scope}</span>}
        </span>
        <StatusButtons
          value={m.status} disabled={pending} label={`Status of mandate at ${m.orgName}`}
          onChange={(s) => s !== m.status && run(() => setMandateStatus(m.id, s))}
        />
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Remove this mandate and its history? Closing it instead keeps the record.</span>
          <button type="button" autoFocus onClick={() => setConfirming(false)} className="h-7 rounded-md border border-border px-2 hover:bg-muted">Keep mandate</button>
          <button type="button" disabled={pending} onClick={() => run(() => removeMandate(m.id))} className="h-7 rounded-md border border-red-600 px-2 text-red-700 hover:bg-red-50">
            {pending ? 'Removing…' : 'Remove mandate'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-muted-foreground underline hover:text-foreground">Remove mandate</button>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </li>
  )
}

/**
 * A recruiter's mandates, with a form to add one. The company has to be in the
 * CRM already — mandates attach to a real record, so a typo can't mint a new company.
 */
export function CrmMandates({ recruiterId, mandates }: { recruiterId: string; mandates: MandateRow[] }) {
  const [adding, setAdding] = useState(false)
  const [company, setCompany] = useState('')
  const [scope, setScope] = useState('')
  const [status, setStatus] = useState<MandateStatusKey>('ACTIVE')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      const r = await addMandate(recruiterId, { company, scope, status })
      if (r.ok) { setCompany(''); setScope(''); setStatus('ACTIVE'); setError(''); setAdding(false) }
      else setError(r.error) // keep what was typed
    })

  return (
    <div className="space-y-3">
      {mandates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mandates yet. Add one when a company has engaged this recruiter on a search.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {mandates.map((m) => <MandateItem key={m.id} m={m} />)}
        </ul>
      )}
      {adding ? (
        <form onSubmit={(e) => { e.preventDefault(); save() }} className={`flex flex-wrap items-end gap-2 ${pending ? 'cursor-progress' : ''}`}>
          <label className="space-y-1 text-xs">
            <span className="block text-muted-foreground">Company</span>
            <input autoFocus value={company} onChange={(e) => setCompany(e.target.value)} className={`${field} w-56`} placeholder="Company name" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="block text-muted-foreground">Roles covered (optional)</span>
            <input value={scope} onChange={(e) => setScope(e.target.value)} className={`${field} w-64`} placeholder="e.g. VP and above, finance" />
          </label>
          <StatusButtons value={status} onChange={setStatus} label="Mandate status" />
          <button type="submit" disabled={pending} className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground">{pending ? 'Adding…' : 'Add mandate'}</button>
          <button type="button" onClick={() => { setAdding(false); setError('') }} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted">Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted">Add mandate</button>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
