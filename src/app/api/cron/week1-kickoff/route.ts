import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWeek1Kickoff } from '@/lib/email/send-week1-kickoff'

// Fires daily — independent of the weekly candidate-email-dispatch cron,
// since this one-time onboarding email depends on days-since-registration,
// not day-of-week. lastDailyEmailSentAt is the "already sent today" guard,
// shared with the legacy field name from before the weekly-cadence split.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)

  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      dailyEmailOptedOut: false,
      notificationTier: { not: 'MINIMAL' },
      OR: [{ lastDailyEmailSentAt: null }, { lastDailyEmailSentAt: { lt: startOfTodayUTC } }],
    },
    select: { id: true, registrationCompletedAt: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      const daysSinceRegistration = candidate.registrationCompletedAt
        ? (Date.now() - candidate.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
        : 0
      if (Math.floor(daysSinceRegistration) !== 1) continue

      const result = await sendWeek1Kickoff(candidate.id)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Week 1 kickoff failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
