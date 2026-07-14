'use client'

import { useActionState, useState } from 'react'
import { updateDesire } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { FourStopSlider } from './FourStopSlider'
import { cn } from '@/lib/utils'

const DESIRE_CHOICES = [
  { value: 10, label: 'Casually looking' },
  { value: 40, label: "I'm interested and will work hard" },
  { value: 70, label: 'I really need a job and will work extremely hard' },
  { value: 100, label: "I need this and will do whatever it takes" },
] as const

export function DesireSlider({ defaultValue }: { defaultValue: number | null }) {
  const [state, formAction, pending] = useActionState(updateDesire, undefined)
  const [value, setValue] = useState(defaultValue ?? DESIRE_CHOICES[0].value)

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <FourStopSlider name="jobSearchIntensity" choices={DESIRE_CHOICES} defaultValue={defaultValue} onChange={setValue} />

      {value < 25 && (
        <p className="rounded-md border border-orange/30 bg-orange/5 p-3 text-sm text-foreground">
          Honestly — this level of intensity will show up in your Hireability Score. Recruiters
          notice candidates who are all-in. If you&apos;re just testing the waters, that&apos;s
          okay, but know it will affect your score until that changes.
        </p>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
