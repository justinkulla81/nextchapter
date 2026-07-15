'use client'

import { useState } from 'react'
import { acceptContract, continueWithoutContract } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'

export function ContractChoice() {
  const [showExplanation, setShowExplanation] = useState(false)

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex flex-wrap justify-center gap-3">
        <form action={acceptContract}>
          <SubmitButton pendingLabel="Continuing…">Yes, I&apos;m ready to commit</SubmitButton>
        </form>
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
            for an A in Search Execution adjusts to match what you can actually put in right now,
            instead of assuming 8-12 hours a week. You can always come back and commit later.
          </p>
          <form action={continueWithoutContract}>
            <SubmitButton variant="outline" pendingLabel="Continuing…">
              Continue at my own pace
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  )
}
