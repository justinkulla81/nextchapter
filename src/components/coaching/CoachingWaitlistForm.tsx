'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { joinCoachingWaitlist } from '@/app/coaching/actions'

interface KnownContact {
  email: string
  firstName: string | null
  lastName: string | null
}

export function CoachingWaitlistForm({
  source,
  knownContact,
}: {
  source: string
  knownContact?: KnownContact
}) {
  const [state, formAction, pending] = useActionState(joinCoachingWaitlist.bind(null, source), undefined)

  if (state?.sent) {
    return (
      <p className="text-sm text-foreground">
        You&apos;re on the list — we&apos;ll reach out as spots open up.
      </p>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-wait [&_*]:cursor-wait')}>
      {knownContact ? (
        <>
          <input type="hidden" name="email" value={knownContact.email} />
          <input type="hidden" name="firstName" value={knownContact.firstName ?? ''} />
          <input type="hidden" name="lastName" value={knownContact.lastName ?? ''} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required aria-invalid={!!state?.error} />
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
        </>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="challenge">
          What would you want help with? <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="challenge" name="challenge" rows={3} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Joining…' : 'Join the waitlist'}
      </Button>
    </form>
  )
}
