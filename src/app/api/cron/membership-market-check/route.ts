import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runQuarterlyMarketCheck } from '@/lib/membership/market-check'
import { sendMembershipNoticeEmail } from '@/lib/email/send-membership-notice'
import { captureServerEvent } from '@/lib/posthog/server'

const CHECK_INTERVAL_DAYS = 89 // quarterly, with a couple days' slack

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// §A2.4 "quarterly market check with comp benchmarking." Daily scan for
// members due (never checked, or checked >89 days ago) — same shape as
// membership-dossier-refresh above.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CHECK_INTERVAL_DAYS)

  const due = await prisma.membershipSubscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ lastMarketCheckAt: null }, { lastMarketCheckAt: { lt: cutoff } }],
    },
    select: { candidateId: true, candidate: { select: { email: true, firstName: true } } },
  })

  let checkedCount = 0
  for (const subscription of due) {
    try {
      await runQuarterlyMarketCheck(subscription.candidateId)
      if (subscription.candidate.email) {
        await sendMembershipNoticeEmail({
          to: subscription.candidate.email,
          subject: 'Your quarterly market check is ready',
          heading: 'Your quarterly market check is in',
          bodyLines: [
            `Hi ${subscription.candidate.firstName ?? 'there'} — your NextChapter Membership includes a quarterly check on job-market conditions and comp benchmarking for your target role.`,
          ],
          ctaLabel: 'View your results',
          ctaUrl: `${appUrl()}/dashboard/membership`,
        })
      }
      captureServerEvent(subscription.candidateId, 'membership_market_check_completed', {})
      checkedCount += 1
    } catch (error) {
      console.error('Membership market check failed for candidate', subscription.candidateId, error)
    }
  }

  return NextResponse.json({ due: due.length, checked: checkedCount })
}
