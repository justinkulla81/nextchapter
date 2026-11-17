'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { linkResponseFunding, saveFundingApplication, setResponseStep, type HubResult } from '@/app/i/[slug]/(portal)/hub-actions'
import { FUNDING_STATUSES } from '@/lib/workforce/hub-flow'

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

function Msg({ r }: { r: HubResult }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-xs', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

// One step of a layoff response: mark it done, or take it back.
export function StepToggle({ slug, responseId, stepKey, done }: { slug: string; responseId: string; stepKey: string; done: boolean }) {
  const [state, action] = useActionState<HubResult, FormData>(setResponseStep.bind(null, slug), undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="responseId" value={responseId} />
      <input type="hidden" name="key" value={stepKey} />
      <input type="hidden" name="done" value={done ? '0' : '1'} />
      <SubmitButton size="sm" variant={done ? 'ghost' : 'outline'} pendingLabel="Saving…">
        {done ? 'Undo' : 'Mark done'}
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}

// Which funding application pays for a response.
export function LinkFunding({ slug, responseId, current, options }: { slug: string; responseId: string; current: string | null; options: { id: string; name: string }[] }) {
  const [state, action] = useActionState<HubResult, FormData>(linkResponseFunding.bind(null, slug), undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="responseId" value={responseId} />
      <div className="space-y-1">
        <Label htmlFor={`fund-${responseId}`} className="text-xs">
          Paid for by
        </Label>
        <select id={`fund-${responseId}`} name="fundingId" defaultValue={current ?? ''} className={cn(sel, 'w-64')}>
          <option value="">Not linked to funding</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
        Save link
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}

type Initial = { id?: string; name?: string; funder?: string | null; status?: string; amountRequested?: number | null; amountAwarded?: number | null; matchRequired?: number | null; matchCommitted?: number | null; dueDate?: string; partners?: string; notes?: string | null }

// Add or edit a funding application. The five-or-more statuses are a dropdown; the rest are plain fields.
export function FundingForm({ slug, initial = {} }: { slug: string; initial?: Initial }) {
  const [state, action] = useActionState<HubResult, FormData>(saveFundingApplication.bind(null, slug), undefined)
  const k = initial.id ?? 'new'
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={initial.id ?? ''} />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`fa-name-${k}`}>Grant or funding</Label>
        <Input id={`fa-name-${k}`} name="name" required maxLength={160} defaultValue={initial.name ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-status-${k}`}>Status</Label>
        <select id={`fa-status-${k}`} name="status" defaultValue={initial.status ?? 'CONSIDERING'} className={sel}>
          {FUNDING_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-funder-${k}`}>Funder</Label>
        <Input id={`fa-funder-${k}`} name="funder" maxLength={160} defaultValue={initial.funder ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-due-${k}`}>Due date</Label>
        <Input id={`fa-due-${k}`} name="dueDate" type="date" defaultValue={initial.dueDate ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-partners-${k}`}>Partners (comma separated)</Label>
        <Input id={`fa-partners-${k}`} name="partners" defaultValue={initial.partners ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-req-${k}`}>Amount requested ($)</Label>
        <Input id={`fa-req-${k}`} name="amountRequested" inputMode="numeric" defaultValue={initial.amountRequested ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-awd-${k}`}>Amount awarded ($)</Label>
        <Input id={`fa-awd-${k}`} name="amountAwarded" inputMode="numeric" defaultValue={initial.amountAwarded ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-mreq-${k}`}>Match required ($)</Label>
        <Input id={`fa-mreq-${k}`} name="matchRequired" inputMode="numeric" defaultValue={initial.matchRequired ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fa-mcom-${k}`}>Match committed ($)</Label>
        <Input id={`fa-mcom-${k}`} name="matchCommitted" inputMode="numeric" defaultValue={initial.matchCommitted ?? ''} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`fa-notes-${k}`}>Notes</Label>
        <Input id={`fa-notes-${k}`} name="notes" maxLength={2000} defaultValue={initial.notes ?? ''} />
      </div>
      <div className="flex items-end gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Saving…">{initial.id ? 'Save changes' : 'Add application'}</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}
