'use client'

import { useActionState } from 'react'
import { submitThoughtLeadershipUnlock } from '@/app/dashboard/thought-leadership/actions'
import { FourStopSlider } from '@/components/onboarding/FourStopSlider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { COMFORT_LEVEL_CHOICES, CONTENT_VENUE_OPTIONS } from '@/lib/constants/content-venues'

export function ThoughtLeadershipUnlockForm() {
  const [state, formAction, pending] = useActionState(submitThoughtLeadershipUnlock, undefined)

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label>How comfortable are you sharing your thoughts publicly?</Label>
        <FourStopSlider name="comfortLevel" choices={COMFORT_LEVEL_CHOICES} defaultValue={null} />
      </div>

      <div className="space-y-2">
        <Label>Where would you actually post this? (pick at least one)</Label>
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
