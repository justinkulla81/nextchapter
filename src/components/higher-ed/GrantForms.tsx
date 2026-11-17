'use client'

// Development › Grants and RFPs: add a grant the team found, and the extra
// states to search. Inputs stay filled when a save fails; busy cursor while
// saving; every result is said in words.

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { addCustomGrant, setGrantStates, type GrantFormResult } from '@/app/i/[slug]/(portal)/development-actions'

const PURPOSES = [
  { key: 'retraining', label: 'Retraining' },
  { key: 'entrepreneurship', label: 'Entrepreneurship' },
  { key: 'research', label: 'Research' },
]

function Msg({ r }: { r: GrantFormResult }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

export function AddGrantForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<GrantFormResult, FormData>(addCustomGrant.bind(null, slug), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="cg-title">Grant or program</Label>
        <Input id="cg-title" name="title" placeholder="Workforce Innovation Grant" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cg-funder">Funder</Label>
        <Input id="cg-funder" name="funder" placeholder="State or foundation" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cg-url">Link to the official notice</Label>
        <Input id="cg-url" name="url" type="url" placeholder="https://" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cg-deadline">Deadline (optional)</Label>
        <Input id="cg-deadline" name="deadline" type="date" />
      </div>
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-sm font-medium">For</legend>
        <div className="flex flex-wrap gap-4">
          {PURPOSES.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="purposes" value={p.key} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cg-note">Note for the team (optional)</Label>
        <Input id="cg-note" name="note" placeholder="Who owns it, who to call" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add grant</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function GrantStatesForm({ slug, current, own }: { slug: string; current: string[]; own: string[] }) {
  const [state, action] = useActionState<GrantFormResult, FormData>(setGrantStates.bind(null, slug), undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="gs-states">Also search these states</Label>
        <Input id="gs-states" name="states" defaultValue={current.join(', ')} placeholder="FL, NY" className="w-48" aria-describedby="gs-help" />
      </div>
      <SubmitButton variant="outline" pendingLabel="Saving…">
        Save states
      </SubmitButton>
      <Msg r={state} />
      <p id="gs-help" className="w-full text-xs text-muted-foreground">
        {own.length ? `Your own: ${own.join(', ')}. ` : ''}Add a second campus or a large alumni region, as two-letter codes.
      </p>
    </form>
  )
}
