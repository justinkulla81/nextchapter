'use client'

import { useActionState, useState } from 'react'
import type { NotificationTier } from '@prisma/client'
import { submitContract } from '@/app/onboarding/actions'
import { ACCOUNTABILITY_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function ContractChoice() {
  const [state, formAction, pending] = useActionState(submitContract, undefined)
  const [showExplanation, setShowExplanation] = useState(false)
  const [tier, setTier] = useState<NotificationTier | null>(null)

  return (
    <form
      action={formAction}
      className={cn('w-full max-w-2xl space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2 text-left">
        <p className="text-sm font-medium text-foreground">
          How much do you want to be nudged and held accountable?
        </p>
        <ChoiceButtons
          name="notificationTier"
          options={ACCOUNTABILITY_LEVEL_OPTIONS}
          value={tier}
          onChange={setTier}
          columns={3}
          responsive
        />
      </div>

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
