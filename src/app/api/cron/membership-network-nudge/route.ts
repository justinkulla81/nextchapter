import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMembershipNoticeEmail } from '@/lib/email/send-membership-notice'
import { captureServerEvent } from '@/lib/posthog/server'

const NUDGE_INTERVAL_DAYS = 30

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// §A2.4 "network maintenance nudges" — a simple real reminder, same shape as
// registration-reminders (bearer auth, findMany the due population,
// per-row try/catch, update a timestamp on success).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - NUDGE_INTERVAL_DAYS)

  const due = await prisma.membershipSubscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ lastNetworkNudgeSentAt: null }, { lastNetworkNudgeSentAt: { lt: cutoff } }],
    },
    select: { candidateId: true, candidate: { select: { email: true, firstName: true } } },
  })

  let sentCount = 0
  for (const subscription of due) {
    if (!subscription.candidate.email) continue
    try {
      const result = await sendMembershipNoticeEmail({
        to: subscription.candidate.email,
        subject: 'A quick nudge to keep your network warm',
        heading: 'Stay a name people remember',
        bodyLines: [
          `Hi ${subscription.candidate.firstName ?? 'there'} — as a NextChapter Member, staying visible to your network pays off long after your search ends. Take five minutes to check in with a contact or two.`,
        ],
        ctaLabel: 'Go to Network with Contacts',
        ctaUrl: `${appUrl()}/dashboard/network`,
      })
      if (result.sent) {
        await prisma.membershipSubscription.update({
          where: { candidateId: subscription.candidateId },
          data: { lastNetworkNudgeSentAt: new Date() },
        })
        captureServerEvent(subscription.candidateId, 'membership_network_nudge_sent', {})
        sentCount += 1
      }
    } catch (error) {
      console.error('Membership network nudge failed for candidate', subscription.candidateId, error)
    }
  }

  return NextResponse.json({ due: due.length, sent: sentCount })
}
