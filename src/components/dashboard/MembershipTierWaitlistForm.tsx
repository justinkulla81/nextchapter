'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { joinMembershipWaitlist } from '@/app/dashboard/plans/actions'

interface KnownContact {
  candidateId: string
  email: string
  firstName: string | null
  lastName: string | null
}

export function MembershipTierWaitlistForm({
  tier,
  source,
  knownContact,
  ctaLabel = 'Join the waitlist',
}: {
  tier: string
  source: string
  knownContact: KnownContact
  ctaLabel?: string
}) {
  const [state, formAction, pending] = useActionState(joinMembershipWaitlist.bind(null, tier, source), undefined)

  if (state?.sent) {
    return (
      <p className="text-sm font-medium text-success">You&apos;re on the list — we&apos;ll reach out as spots open up.</p>
    )
  }

  return (
    <form action={formAction} className={cn(pending && 'cursor-wait [&_*]:cursor-wait')}>
      <input type="hidden" name="candidateId" value={knownContact.candidateId} />
      <input type="hidden" name="email" value={knownContact.email} />
      <input type="hidden" name="firstName" value={knownContact.firstName ?? ''} />
      <input type="hidden" name="lastName" value={knownContact.lastName ?? ''} />
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Joining…' : ctaLabel}
      </Button>
    </form>
  )
}
