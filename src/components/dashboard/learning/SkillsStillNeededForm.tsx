'use client'

import { useActionState, useState } from 'react'
import { updateSkillsStillNeeded } from '@/app/dashboard/learning/actions'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function SkillsStillNeededForm({ skillsStillNeeded }: { skillsStillNeeded: string | null }) {
  const [state, formAction, pending] = useActionState(updateSkillsStillNeeded, undefined)
  const [value, setValue] = useState(skillsStillNeeded ?? '')

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <Textarea
        name="skillsStillNeeded"
        placeholder="e.g. I want to get better at financial modeling, or learn enough SQL to pull my own data"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <SubmitButton variant="outline" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </SubmitButton>
    </form>
  )
}
