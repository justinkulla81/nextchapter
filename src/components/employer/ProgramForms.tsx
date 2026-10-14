'use client'

import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { saveProgramDetails, setProgramFeature } from '@/app/employer/(app)/program/actions'
import type { ProgramFeatureKey } from '@/lib/employer/program-settings'

export function ProgramDetailsForm({ programBrandName, welcome }: { programBrandName: string | null; welcome: string | null }) {
  const [state, action] = useActionState(saveProgramDetails, undefined)
  const [v, setV] = useState({ programBrandName: programBrandName ?? '', welcome: welcome ?? '' })
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pg-name">Program name (optional)</Label>
        <Input id="pg-name" name="programBrandName" value={v.programBrandName} maxLength={80} onChange={(e) => setV({ ...v, programBrandName: e.target.value })} placeholder="Acme Career Transition Program" className="max-w-md" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pg-welcome">Welcome message</Label>
        <textarea id="pg-welcome" name="welcome" value={v.welcome} maxLength={1000} onChange={(e) => setV({ ...v, welcome: e.target.value })} className="min-h-24 w-full max-w-2xl rounded-md border border-input bg-background p-2 text-sm" placeholder="A few lines from leadership: thanks, what the program covers, who to call with questions." />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save program details</SubmitButton>
        {(state?.ok || state?.error) && (
          <p role={state.error ? 'alert' : 'status'} className={cn('text-sm', state.error ? 'text-destructive' : 'text-muted-foreground')}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
    </form>
  )
}

export function ProgramFeatureToggle({ featureKey, label, on: initial }: { featureKey: ProgramFeatureKey; label: string; on: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className={cn('flex items-center gap-2', pending && 'cursor-wait')}>
      <Button
        size="sm"
        variant={on ? 'default' : 'outline'}
        aria-pressed={on}
        aria-label={`${label}: ${on ? 'offered' : 'not offered'}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setProgramFeature(featureKey, !on)
            if (r.error) setError(r.error)
            else {
              setError(null)
              setOn(!on)
            }
          })
        }
      >
        {on ? 'Offered' : 'Off'}
      </Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
