import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRegistrationReminderEmail } from '@/lib/email/send-registration-reminder'

// Day offsets (from assessmentCompletedAt) at which reminder N (0-indexed)
// fires: day 1, day 7, then weekly through day 56 — 9 emails max, then we
// stop rather than remind an abandoned lead forever.
const REMINDER_SCHEDULE_DAYS = [1, 7, 14, 21, 28, 35, 42, 49, 56]

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const eligible = await prisma.candidateProfile.findMany({
    where: {
      assessmentComplete: true,
      assessmentCompletedAt: { not: null },
      registrationCompletedAt: null,
      isSampleData: false,
      reminderEmailsOptedOut: false,
      email: { not: null },
      reminderEmailCount: { lt: REMINDER_SCHEDULE_DAYS.length },
    },
  })

  const admin = createAdminClient()
  let sentCount = 0

  for (const candidate of eligible) {
    const dueDay = REMINDER_SCHEDULE_DAYS[candidate.reminderEmailCount]
    if (daysSince(candidate.assessmentCompletedAt!) < dueDay) continue

    try {
      // Attach + auto-confirm the resume-extracted email on this still-
      // anonymous auth user (idempotent — safe to repeat) so generateLink
      // can mint a magic link for it, even if the candidate never reached
      // the create-account step themselves.
      await admin.auth.admin.updateUserById(candidate.userId, {
        email: candidate.email!,
        email_confirm: true,
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: candidate.email!,
        options: { redirectTo: `${appUrl}/auth/magic-link` },
      })
      if (linkError || !linkData.properties?.action_link) {
        console.error('Failed to generate reminder magic link for', candidate.id, linkError)
        continue
      }

      const result = await sendRegistrationReminderEmail({
        candidateId: candidate.id,
        magicLink: linkData.properties.action_link,
      })

      if (result.sent) {
        sentCount += 1
        await prisma.candidateProfile.update({
          where: { id: candidate.id },
          data: {
            reminderEmailCount: { increment: 1 },
            lastReminderSentAt: new Date(),
          },
        })
      }
    } catch (error) {
      console.error('Registration reminder failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, sent: sentCount })
}
