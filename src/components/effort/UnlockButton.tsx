'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export type UnlockActionState = { ok?: true; error?: string } | undefined

/** The one primary action once a strategy or report is unlocked. Shows the busy cursor while it works. */
export function UnlockButton({
  action,
  label,
  pendingLabel,
  event,
}: {
  action: (prev: UnlockActionState, formData: FormData) => Promise<UnlockActionState>
  label: string
  pendingLabel: string
  event: string
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  return (
    <form
      action={(fd) => {
        posthog.capture(event, {})
        return formAction(fd)
      }}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <SubmitButton pendingLabel={pendingLabel}>{label}</SubmitButton>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-muted-foreground">Done. Your new one is on this page.</p>}
    </form>
  )
}
