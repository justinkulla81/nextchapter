'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { clearCareerChoices } from '@/app/dashboard/pivot/actions'

// Clearing removes the occupation the person picked and the target role they set, which also changes their
// skill suggestions and job matches, so it asks first and the safe choice has the focus.
export function ClearCareerChoicesForm({ occupationSaved, targetRole }: { occupationSaved: boolean; targetRole: string | null }) {
  const [state, action] = useActionState(clearCareerChoices, undefined)
  const [confirming, setConfirming] = useState(false)

  if (state?.message) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.message}
      </p>
    )
  }

  const saved = [occupationSaved ? 'the occupation you picked' : null, targetRole ? `your target role (“${targetRole}”)` : null].filter(Boolean).join(' and ')

  if (!confirming) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">We have saved {saved}.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Clear my saved occupation and target role
        </Button>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-foreground">
        Clear {saved}? Your resume and skills stay. Skill suggestions and job matches will stop using your target role until you set one again.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
          Keep them
        </Button>
        <SubmitButton size="sm" variant="destructive" pendingLabel="Clearing…" savedLabel="Clear them">
          Clear them
        </SubmitButton>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
