'use client'

// The alum's own company, as they choose to share it with their college: name, website, funding to date and an exit.

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

type State = { error?: string; ok?: boolean; message?: string } | undefined
type Opt = readonly (readonly [string, string])[]
type Defaults = { ventureName: string; website: string; fundingRound: string; fundingTotal: string; exitKind: string; exitAcquirer: string; exitYear: string }

function Choice({ name, label, options, value, onChange }: { name: string; label: string; options: Opt; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {options.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(value === k ? '' : k)}
            className={cn('rounded-full border px-3 py-1 text-sm', value === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function VentureReportForm({ action, center, defaults, rounds, totals, exits }: { action: (prev: State, f: FormData) => Promise<State>; center: string; defaults: Defaults; rounds: Opt; totals: Opt; exits: Opt }) {
  const [state, formAction] = useActionState(action, undefined)
  const [round, setRound] = useState(defaults.fundingRound)
  const [total, setTotal] = useState(defaults.fundingTotal)
  const [exit, setExit] = useState(defaults.exitKind)
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v-name">Company name</Label>
          <Input id="v-name" name="ventureName" defaultValue={defaults.ventureName} maxLength={120} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-web">Website (optional)</Label>
          <Input id="v-web" name="website" defaultValue={defaults.website} maxLength={200} placeholder="example.com" />
        </div>
      </div>
      <Choice name="fundingRound" label="Funding so far (optional)" options={rounds} value={round} onChange={setRound} />
      <Choice name="fundingTotal" label="Raised to date (optional)" options={totals} value={total} onChange={setTotal} />
      <Choice name="exitKind" label="An exit? (optional)" options={exits} value={exit} onChange={setExit} />
      {exit && (
        <div className="grid gap-4 sm:grid-cols-2">
          {exit === 'acquired' && (
            <div className="space-y-1.5">
              <Label htmlFor="v-acq">Acquired by</Label>
              <Input id="v-acq" name="exitAcquirer" defaultValue={defaults.exitAcquirer} maxLength={120} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="v-year">Year</Label>
            <Input id="v-year" name="exitYear" inputMode="numeric" defaultValue={defaults.exitYear} maxLength={4} className="w-28" />
          </div>
        </div>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
      <SubmitButton pendingLabel="Saving…">{`Share with ${center}`}</SubmitButton>
    </form>
  )
}
