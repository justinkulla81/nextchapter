'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { setPivotTargetRole } from '@/app/dashboard/pivot/actions'

// "Make this my target role" replaces what the person wrote themselves, which also changes their skill
// suggestions, so when they already have a target role it asks first and the safe choice has the focus.
export function SetTargetRoleForm({ socCode, title, currentTarget }: { socCode: string; title: string; currentTarget: string | null }) {
  const [state, action] = useActionState(setPivotTargetRole, undefined)
  const [confirming, setConfirming] = useState(false)
  const needsConfirm = Boolean(currentTarget) && currentTarget?.trim().toLowerCase() !== title.toLowerCase()

  if (needsConfirm && !confirming && !state?.message) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)} aria-label={`Make ${title} my target role`}>
        Make this my target role
      </Button>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="socCode" value={socCode} />
      {needsConfirm && !state?.message && (
        <>
          <span className="text-xs text-foreground">
            Replace “{currentTarget}” with “{title}” as your target role?
          </span>
          <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
            Keep my current role
          </Button>
        </>
      )}
      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…" savedLabel="Make this my target role" aria-label={`Make ${title} my target role`}>
        {needsConfirm ? 'Replace it' : 'Make this my target role'}
      </SubmitButton>
      {state?.message && (
        <span role="status" className="text-xs text-muted-foreground">
          {state.message}
        </span>
      )}
      {state?.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  )
}
