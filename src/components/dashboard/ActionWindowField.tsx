'use client'

import { useState, useTransition } from 'react'
import type { ActionWindow } from '@prisma/client'
import { setActionWindow } from '@/app/dashboard/actions'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { posthog } from '@/lib/posthog/client'

// "When are you most ready to take action?" in the redesign. Five times of day is too many for side-by-side buttons
// (five or more is a dropdown), so it is one dropdown that saves as you choose and says so.
const OPTIONS: { value: ActionWindow; label: string }[] = [
  { value: 'MORNING', label: 'Plan and act in the morning' },
  { value: 'NIGHT_PLAN_MORNING_ACT', label: 'Plan at night, act in the morning' },
  { value: 'MIDDAY', label: 'Midday' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'VARIABLE', label: 'It varies for me' },
]

export function ActionWindowField({ current }: { current: ActionWindow }) {
  const [value, setValue] = useState<ActionWindow>(current)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  return (
    <div className={pending ? 'cursor-wait' : undefined}>
      <ChoiceField
        name="actionWindow"
        label="When are you most ready to take action?"
        why="Your daily action email arrives in this window."
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          const next = v as ActionWindow
          setValue(next)
          setSaved(false)
          start(async () => {
            await setActionWindow(next)
            posthog.capture('action_window_changed', { from: current, to: next })
            setSaved(true)
          })
        }}
      />
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {pending ? 'Saving…' : saved ? 'Saved.' : ''}
      </p>
    </div>
  )
}
