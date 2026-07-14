import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import CompleteRegistrationReminderEmail from '@/emails/complete-registration-reminder'
import { scoreToGrade, GRADE_BAND_DESCRIPTION } from '@/lib/scoring/grade'

export async function sendRegistrationReminderEmail({
  candidateId,
  magicLink,
}: {
  candidateId: string
  magicLink: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping registration reminder email.')
    return { sent: false as const }
  }

  try {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
    if (!candidate.email) return { sent: false as const }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: candidate.email,
      subject: 'Finish creating your NextChapter account to unlock your report',
      react: CompleteRegistrationReminderEmail({
        firstName: candidate.firstName,
        gradeDescription: GRADE_BAND_DESCRIPTION[scoreToGrade(candidate.employabilityScore)],
        magicLink,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send registration reminder email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break the reminder cron run.
    console.error('Failed to send registration reminder email:', error)
    return { sent: false as const }
  }
}
