'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { submitBountyClaim } from '@/app/dashboard/got-hired/actions'

export function BountyClaimForm() {
  const [state, formAction, pending] = useActionState(submitBountyClaim, undefined)

  if (state?.submitted) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6">
        <p className="text-lg font-semibold text-foreground">Congratulations!</p>
        <p className="mt-2 text-sm text-foreground">
          Thank you for letting us know. We&apos;ll be reaching out with confirmation and payment
          next steps.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle">Role</Label>
          <Input id="roleTitle" name="roleTitle" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="offerLetter">Offer letter or written confirmation</Label>
        <Input id="offerLetter" name="offerLetter" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
        <p className="text-xs text-muted-foreground">
          PDF or image, under 10MB. This is kept private — never shared publicly.
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit for review'}
      </Button>
    </form>
  )
}
