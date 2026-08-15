import 'server-only'
import { prisma } from '@/lib/prisma'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import { captureServerEvent } from '@/lib/posthog/server'

const FREE_MEMBERSHIP_MONTHS = 12

// §A2.4 -- "Free for 12 months to anyone placed through a Premium
// outplacement seat." OutplacementSeat.candidateId is deliberately never
// read by employer/reporting code (see that field's own schema comment) --
// this is a legitimate exception: it's a candidate-side check about their
// OWN placement, not an org-side query joining to candidate data.
async function wasPlacedThroughPremiumOutplacement(candidateId: string): Promise<boolean> {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { candidateId, contract: { tier: 'PREMIUM' } },
    select: { id: true },
  })
  return !!seat
}

export type AlumActivationSource = 'recruiter_placement' | 'bounty_claim_approved'

// The one place that grants `alum` for real (Master Build Script §A2.4) --
// hooked into recordPlacement (src/lib/recruiter/submissions.ts) and
// approveBountyClaim (src/app/support/admin/(portal)/bounty-claims/
// actions.ts), the two human-verified "this candidate really got hired"
// signals in the codebase. Idempotent: grantRoleIfMissing no-ops on a repeat
// call, and an existing MembershipSubscription is never overwritten -- a
// candidate placed twice (e.g. a later recruiter placement after an earlier
// bounty approval) must not reset an already-active/cancelled subscription
// back to a fresh free trial.
export async function activateAlumStatus(candidateId: string, source: AlumActivationSource): Promise<void> {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, userId: true },
  })
  if (!candidate) return

  await grantRoleIfMissing(candidate.userId, 'alum')
  captureServerEvent(candidateId, 'alum_status_activated', { source })

  const existingSubscription = await prisma.membershipSubscription.findUnique({ where: { candidateId } })
  if (existingSubscription) return // Already offered/subscribed once -- self-serve signup is the candidate's own choice from here.

  const premiumPlacement = await wasPlacedThroughPremiumOutplacement(candidateId)
  if (!premiumPlacement) return // Membership stays an offer the candidate accepts themselves -- see /dashboard/membership.

  const plan = await getCurrentPlan('membership_monthly')
  const freeUntil = new Date()
  freeUntil.setMonth(freeUntil.getMonth() + FREE_MEMBERSHIP_MONTHS)

  await prisma.membershipSubscription.create({
    data: {
      candidateId,
      planKey: 'membership_monthly',
      status: 'ACTIVE',
      source: 'FREE_PREMIUM_PLACEMENT',
      freeUntil,
      currentPeriodEnd: freeUntil,
    },
  })
  await grantRoleIfMissing(candidate.userId, 'member')
  captureServerEvent(candidateId, 'membership_auto_activated_free_premium', {
    planKey: plan?.planKey ?? 'membership_monthly',
    freeUntil,
  })
}
