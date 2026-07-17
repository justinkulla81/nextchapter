import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDailyActionEmail } from '@/lib/email/send-daily-action-email'

// Fires once daily (see vercel.json). True per-candidate actionWindow send
// timing (multiple fires/day matched to local time) isn't implemented yet —
// this is a single daily send for everyone eligible; actionWindow is
// collected but not yet used to pick send time.
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
      dailyEmailOptedOut: false,
      notificationTier: { not: 'MINIMAL' },
      OR: [{ lastDailyEmailSentAt: null }, { lastDailyEmailSentAt: { lt: startOfTodayUTC } }],
    },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    const result = await sendDailyActionEmail(candidate.id)
    if (result.sent) sentCount += 1
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
