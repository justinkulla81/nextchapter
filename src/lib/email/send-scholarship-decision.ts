import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import ScholarshipDecisionEmail from '@/emails/scholarship-decision'

export async function sendScholarshipDecisionEmail({
  candidateId,
  approved,
}: {
  candidateId: string
  approved: boolean
}) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { email: true, firstName: true },
  })
  if (!candidate?.email) return { sent: false as const }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping scholarship decision email.')
    return { sent: false as const }
  }

  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: candidate.email,
      subject: approved ? "You're approved for a NextChapter scholarship" : 'An update on your scholarship application',
      react: ScholarshipDecisionEmail({ firstName: candidate.firstName, approved }),
    })

    if (error) {
      console.error('Failed to send scholarship decision email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send scholarship decision email:', error)
    return { sent: false as const }
  }
}
