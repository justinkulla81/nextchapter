'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { hasRoleGrant, grantRoleIfMissing } from '@/lib/auth/role-grants'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

export type FormState = { error?: string; success?: string } | undefined

async function requireCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { user, profile: await getOrCreateCandidateProfile(user.id) }
}

// §A2.4 -- self-serve Membership signup. No live billing this phase (this
// session's established pattern for commercial features) -- a real record
// is created, price is read live from the plan catalog (never hardcoded),
// but no payment is actually collected. Only reachable once a candidate is
// already an alum, per "Membership is offered at placement -- the only
// moment it converts."
export async function subscribeToMembership(billingPeriod: 'MONTHLY' | 'ANNUAL'): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const isAlum = await hasRoleGrant(ctx.user.id, 'alum')
  if (!isAlum) return { error: 'Membership becomes available once you\'re a NextChapter alum.' }

  const existing = await prisma.membershipSubscription.findUnique({ where: { candidateId: ctx.profile.id } })
  if (existing) return { error: 'You already have a Membership record.' }

  const planKey = billingPeriod === 'ANNUAL' ? 'membership_annual' : 'membership_monthly'
  const plan = await getCurrentPlan(planKey)
  if (!plan) return { error: 'Membership pricing isn\'t configured yet — contact support.' }

  const currentPeriodEnd = new Date()
  if (billingPeriod === 'ANNUAL') currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)
  else currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

  await prisma.membershipSubscription.create({
    data: { candidateId: ctx.profile.id, planKey, status: 'ACTIVE', source: 'SELF_SERVE', currentPeriodEnd },
  })
  await grantRoleIfMissing(ctx.user.id, 'member')

  captureServerEvent(ctx.profile.id, 'membership_subscribed', { planKey, priceCents: plan.priceCents })
  revalidatePath('/dashboard/membership')
  return { success: 'You\'re a Member — welcome.' }
}

// §A2.4 "break-glass reactivation" -- a member whose access lapsed can
// reactivate quickly. Real flow: flips MembershipSubscription back to
// ACTIVE, re-grants the `member` role (revoked by membership-lapse-check),
// and extends currentPeriodEnd from today.
export async function reactivateMembership(): Promise<FormState> {
  const ctx = await requireCandidate()
  if (!ctx) return { error: 'You need to be logged in to do this.' }

  const subscription = await prisma.membershipSubscription.findUnique({ where: { candidateId: ctx.profile.id } })
  if (!subscription) return { error: 'No Membership record to reactivate.' }
  if (subscription.status !== 'LAPSED') return { error: 'Your Membership isn\'t lapsed.' }

  const currentPeriodEnd = new Date()
  if (subscription.planKey === 'membership_annual') currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)
  else currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

  await prisma.membershipSubscription.update({
    where: { candidateId: ctx.profile.id },
    data: { status: 'ACTIVE', reactivatedAt: new Date(), lapsedAt: null, currentPeriodEnd },
  })
  await grantRoleIfMissing(ctx.user.id, 'member')

  captureServerEvent(ctx.profile.id, 'membership_reactivated', { planKey: subscription.planKey })
  revalidatePath('/dashboard/membership')
  return { success: 'Membership reactivated — welcome back.' }
}

export async function setPriorityCoachBookingPreference(enabled: boolean): Promise<void> {
  const ctx = await requireCandidate()
  if (!ctx) return

  const subscription = await prisma.membershipSubscription.findUnique({ where: { candidateId: ctx.profile.id } })
  if (!subscription || subscription.status !== 'ACTIVE') return

  await prisma.membershipSubscription.update({
    where: { candidateId: ctx.profile.id },
    data: { priorityCoachBooking: enabled },
  })

  captureServerEvent(ctx.profile.id, 'membership_priority_booking_toggled', { enabled })
  revalidatePath('/dashboard/membership')
}
