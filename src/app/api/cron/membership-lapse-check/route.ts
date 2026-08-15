import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revokeRoleGrant } from '@/lib/auth/role-grants'
import { captureServerEvent } from '@/lib/posthog/server'

// §A2.4 break-glass reactivation needs something real to react against —
// this is the flip side: an ACTIVE MembershipSubscription whose
// currentPeriodEnd (and freeUntil, if set) have both passed with no renewal
// becomes LAPSED, and the `member` RoleGrant is revoked. reactivateMembership
// (src/app/dashboard/membership/actions.ts) is the only path back to ACTIVE.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const overdue = await prisma.membershipSubscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { lt: now },
      OR: [{ freeUntil: null }, { freeUntil: { lt: now } }],
    },
    select: { id: true, candidateId: true, candidate: { select: { userId: true } } },
  })

  let lapsedCount = 0
  for (const subscription of overdue) {
    try {
      await prisma.membershipSubscription.update({
        where: { id: subscription.id },
        data: { status: 'LAPSED', lapsedAt: now },
      })
      await revokeRoleGrant(subscription.candidate.userId, 'member')
      captureServerEvent(subscription.candidateId, 'membership_lapsed', {})
      lapsedCount += 1
    } catch (error) {
      console.error('Membership lapse check failed for subscription', subscription.id, error)
    }
  }

  return NextResponse.json({ checked: overdue.length, lapsed: lapsedCount })
}
