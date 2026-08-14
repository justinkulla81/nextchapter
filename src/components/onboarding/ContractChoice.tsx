'use client'

import { useActionState, useState } from 'react'
import { submitContract } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function ContractChoice() {
  const [state, formAction, pending] = useActionState(submitContract, undefined)
  const [showExplanation, setShowExplanation] = useState(false)

  return (
    <form
      action={formAction}
      className={cn('w-full max-w-2xl space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="flex flex-wrap justify-center gap-3">
        <SubmitButton name="intent" value="accept" pendingLabel="Continuing…">
          Yes, I&apos;m ready to commit
        </SubmitButton>
        {!showExplanation && (
          <Button type="button" variant="outline" onClick={() => setShowExplanation(true)}>
            Not right now — tell me more
          </Button>
        )}
      </div>

      {showExplanation && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-left text-sm text-muted-foreground">
          <p>
            That&apos;s okay — NextChapter still works at a lower intensity. It just means the bar
            for an A adjusts to match what you can actually put in right now,
            instead of assuming 8-12 hours a week. You can always come back and commit later.
          </p>
          <SubmitButton name="intent" value="decline" variant="outline" pendingLabel="Continuing…">
            Continue at my own pace
          </SubmitButton>
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
