'use client'

import { useActionState, useState } from 'react'
import type { NotificationTier } from '@prisma/client'
import { submitContract } from '@/app/onboarding/actions'
import { ACCOUNTABILITY_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function ContractChoice() {
  const [state, formAction, pending] = useActionState(submitContract, undefined)
  const [showExplanation, setShowExplanation] = useState(false)
  const [tier, setTier] = useState<NotificationTier | null>(null)
  const [smsConsent, setSmsConsent] = useState(false)

  return (
    <form
      action={formAction}
      className={cn('w-full max-w-md space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
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
          columns={1}
        />
      </div>

      {tier === 'FULL' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-left">
          <p className="text-sm font-medium text-foreground">Want text nudges too? (optional)</p>
          <div className="space-y-2">
            <Label htmlFor="smsPhone">Mobile number</Label>
            <Input
              id="smsPhone"
              name="smsPhone"
              type="tel"
              placeholder="(555) 123-4567"
              className="max-w-xs"
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="smsConsent"
              name="smsConsent"
              checked={smsConsent}
              onCheckedChange={(checked) => setSmsConsent(checked === true)}
            />
            <Label htmlFor="smsConsent" className="text-sm font-normal text-muted-foreground">
              I agree to receive automated text messages from NextChapter at the number above.
              Message and data rates may apply. Message frequency varies. Reply STOP to opt out at
              any time. This consent isn&apos;t required to use NextChapter and is separate from
              your email preferences.
            </Label>
          </div>
        </div>
      )}

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
