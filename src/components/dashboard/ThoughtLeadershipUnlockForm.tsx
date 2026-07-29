'use client'

import { useActionState, useState } from 'react'
import { submitThoughtLeadershipUnlock } from '@/app/dashboard/marketing-plan/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { COMFORT_LEVEL_CHOICES, CONTENT_VENUE_OPTIONS } from '@/lib/constants/content-venues'

export function ThoughtLeadershipUnlockForm() {
  const [state, formAction, pending] = useActionState(submitThoughtLeadershipUnlock, undefined)
  const [comfortLevel, setComfortLevel] = useState<number | null>(null)

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Set up your Marketing Plan</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +5 pts, one time
        </span>
      </div>
      <div className="space-y-2">
        <Label>What kind of thought leadership have you done?</Label>
        <div className="flex flex-wrap gap-4">
          {CONTENT_VENUE_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox id={`venue-${opt.value}`} name="venues" value={opt.value} />
              <Label htmlFor={`venue-${opt.value}`} className="font-normal">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Do you like doing these thought leadership pieces?</Label>
        <input type="hidden" name="comfortLevel" value={comfortLevel ?? ''} />
        <div className="flex flex-wrap gap-2">
          {COMFORT_LEVEL_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={comfortLevel === choice.value}
              onClick={() => setComfortLevel(choice.value)}
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
                comfortLevel === choice.value
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
