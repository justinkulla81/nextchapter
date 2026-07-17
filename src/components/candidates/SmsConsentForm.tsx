'use client'

import { useActionState } from 'react'
import { updateSmsConsent } from '@/app/dashboard/privacy/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function SmsConsentForm({
  smsPhone,
  smsConsented,
}: {
  smsPhone: string | null
  smsConsented: boolean
}) {
  const [state, formAction, pending] = useActionState(updateSmsConsent, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className="text-sm text-muted-foreground">
        Text nudges aren&apos;t live yet — opting in now means you&apos;re ready the moment we
        turn them on. You can change this anytime.
      </p>

      <div className="space-y-2">
        <Label htmlFor="smsPhone">Mobile number</Label>
        <Input
          id="smsPhone"
          name="smsPhone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={smsPhone ?? ''}
          className="max-w-xs"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="smsConsent" name="smsConsent" defaultChecked={smsConsented} />
        <Label htmlFor="smsConsent" className="font-normal">
          I agree to receive automated text messages from NextChapter at the number above.
          Message and data rates may apply. Message frequency varies. Reply STOP to opt out at
          any time. This consent isn&apos;t required to use NextChapter and is separate from your
          email preferences.
        </Label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton variant="outline" pendingLabel="Saving…">
        Save text message preference
      </SubmitButton>
    </form>
  )
}
