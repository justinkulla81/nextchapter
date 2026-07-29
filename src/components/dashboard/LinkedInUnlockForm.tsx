'use client'

import { useActionState, useState } from 'react'
import { submitLinkedInUnlock } from '@/app/dashboard/linkedin/actions'
import { FourStopSlider } from '@/components/onboarding/FourStopSlider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const OPENNESS_CHOICES = [
  { value: 10, label: 'Not at all — I want this kept quiet' },
  { value: 40, label: "A little uneasy, but I'll try" },
  { value: 70, label: 'Fairly comfortable' },
  { value: 100, label: "I'm openly telling my network" },
] as const

const USAGE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never' },
] as const

export function LinkedInUnlockForm() {
  const [state, formAction, pending] = useActionState(submitLinkedInUnlock, undefined)
  const [usageFrequency, setUsageFrequency] = useState<string | null>(null)
  const [profileUpToDate, setProfileUpToDate] = useState<string | null>(null)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-6 rounded-lg border border-border p-4',
        pending && 'cursor-wait [&_*]:cursor-wait'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Unlock the LinkedIn post generator</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +5 pts, one time
        </span>
      </div>
      <div className="space-y-2">
        <Label>How do you feel about being open about your job search?</Label>
        <FourStopSlider name="opennessComfort" choices={OPENNESS_CHOICES} defaultValue={null} />
      </div>

      <div className="space-y-2">
        <Label>How much do you use LinkedIn?</Label>
        <input type="hidden" name="usageFrequency" value={usageFrequency ?? ''} />
        <div className="grid grid-cols-4 gap-1.5">
          {USAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUsageFrequency(opt.value)}
              aria-pressed={usageFrequency === opt.value}
              className={cn(
                'rounded-lg border-2 p-2 text-center text-sm font-medium transition-colors',
                usageFrequency === opt.value
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Is your LinkedIn profile up to date?</Label>
        <input type="hidden" name="profileUpToDate" value={profileUpToDate ?? ''} />
        <div className="grid grid-cols-2 gap-1.5">
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setProfileUpToDate(v)}
              aria-pressed={profileUpToDate === v}
              className={cn(
                'rounded-lg border-2 p-2 text-center text-sm font-medium capitalize transition-colors',
                profileUpToDate === v
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
