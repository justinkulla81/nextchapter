'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { submitBountyClaim } from '@/app/dashboard/got-hired/actions'

const PAYMENT_METHODS = [
  { value: 'VENMO', label: 'Venmo' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'ZELLE', label: 'Zelle' },
] as const

export function BountyClaimForm() {
  const [state, formAction, pending] = useActionState(submitBountyClaim, undefined)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  if (state?.submitted) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6">
        <p className="text-lg font-semibold text-foreground">Congratulations — that&apos;s huge. 🎉</p>
        <p className="mt-2 text-sm text-foreground">
          I&apos;ve got your details and your offer letter. I&apos;ll review it and follow up —
          usually within a few days. Go celebrate. — Victoria
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
        <Label>How would you like to be paid?</Label>
        <input type="hidden" name="paymentMethod" value={paymentMethod ?? ''} />
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => setPaymentMethod(method.value)}
              aria-pressed={paymentMethod === method.value}
              className={cn(
                'rounded-lg border-2 p-2 text-center text-sm font-medium transition-colors',
                paymentMethod === method.value
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paymentHandle">
          {paymentMethod ? `Your ${paymentMethod === 'VENMO' ? 'Venmo' : paymentMethod === 'PAYPAL' ? 'PayPal' : 'Zelle'} handle` : 'Payment handle'}{' '}
          <span className="text-muted-foreground">(optional — you can also confirm this later)</span>
        </Label>
        <Input id="paymentHandle" name="paymentHandle" />
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
