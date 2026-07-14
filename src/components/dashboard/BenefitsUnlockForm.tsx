'use client'

import { useActionState } from 'react'
import { submitBenefitsUnlock } from '@/app/dashboard/benefits/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function BenefitsUnlockForm() {
  const [state, formAction, pending] = useActionState(submitBenefitsUnlock, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="answer">What&apos;s the biggest financial pressure on you right now?</Label>
        <p className="text-sm text-muted-foreground">
          Health coverage, a specific bill, how long your savings last — whatever it actually is.
          We&apos;ll use this to point you at the parts of this page that matter most to you.
        </p>
        <Textarea id="answer" name="answer" required rows={3} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Building your plan…' : 'Continue'}
      </Button>
    </form>
  )
}
