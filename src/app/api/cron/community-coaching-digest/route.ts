import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendCommunityCoachingDigestEmail } from '@/lib/email/send-community-coaching-digest'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Fires Saturday morning — a quiet weekly digest of encouragement notes
// received and any coaching session logged in the last 7 days. Skips
// silently for anyone with nothing to report rather than sending an empty
// "nothing happened" email.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const windowStart = new Date(Date.now() - SEVEN_DAYS_MS)

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null }, weeklyReportOptedOut: false },
    select: { id: true, userId: true, firstName: true, notificationTier: true },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue

      const [encouragementCount, coachSessionCount] = await Promise.all([
        prisma.encouragementNote.count({
          where: { toCandidateId: candidate.id, sentAt: { gte: windowStart } },
        }),
        prisma.coachSession.count({
          where: { candidateId: candidate.id, occurredAt: { gte: windowStart } },
        }),
      ])

      if (encouragementCount === 0 && coachSessionCount === 0) continue

      const result = await sendCommunityCoachingDigestEmail(candidate, encouragementCount, coachSessionCount > 0)
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Community & coaching digest failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
