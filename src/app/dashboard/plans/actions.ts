'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

export type MembershipWaitlistFormState = { error?: string; sent?: boolean } | undefined

// Mirrors joinCoachingWaitlist exactly (src/app/coaching/actions.ts) — same
// no-payment, no-access-control interest-signal pattern, now typed per tier
// instead of per coaching product. Nothing here creates a Stripe customer,
// charges a card, or unlocks anything; it only writes a MembershipTierWaitlist row.
export async function joinMembershipWaitlist(
  tier: string,
  source: string,
  _prevState: MembershipWaitlistFormState,
  formData: FormData
): Promise<MembershipWaitlistFormState> {
  const email = (formData.get('email') as string | null)?.trim()
  const firstName = (formData.get('firstName') as string | null)?.trim() || null
  const lastName = (formData.get('lastName') as string | null)?.trim() || null
  const candidateId = (formData.get('candidateId') as string | null)?.trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email.' }
  }

  await prisma.membershipTierWaitlist.create({
    data: { candidateId, email, firstName, lastName, tier, source },
  })
  notifyNewLead({ email, name: [firstName, lastName].filter(Boolean).join(' ') || null, channel: 'Plan waitlist', detail: `${tier} · ${source}` })
  captureServerEvent(candidateId ?? email, 'membership_tier_waitlist_joined', { tier, source })

  return { sent: true }
}
