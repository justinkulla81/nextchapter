'use client'

import { useActionState } from 'react'
import { regenerateMarketReport, type RegenerateState } from '@/app/dashboard/market-reality/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// The one primary action on the market report. When it cannot run, it says why in the same place and what
// to do next, instead of just going gray.
export function RegenerateReport({ allowed, message }: { allowed: boolean; message: string }) {
  const [state, action] = useActionState<RegenerateState, FormData>(regenerateMarketReport, undefined)
  return (
    <form action={action} className="max-w-sm space-y-2 sm:text-right">
      <SubmitButton
        disabled={!allowed}
        pendingLabel="Refreshing your report…"
        savedLabel="Refreshed"
        className="h-11 rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95"
      >
        Regenerate after your improvements
      </SubmitButton>
      <p className="text-sm text-muted-foreground" role={state?.error ? 'alert' : 'status'}>
        {state?.error ?? (state?.ok ? 'Your report now reflects what you have done since the last one.' : message)}
      </p>
    </form>
  )
}
