import 'server-only'
import { Resend } from 'resend'
import ReferenceDeclinedEmail from '@/emails/reference-declined'
import { prisma } from '@/lib/prisma'

export async function sendReferenceDeclinedNotice({
  candidateId,
  candidateName,
  refereeName,
}: {
  candidateId: string
  candidateName: string
  refereeName: string
}) {
  const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { email: true } })
  if (!candidate?.email) return { sent: false as const }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping reference declined notice.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: candidate.email,
      subject: `${refereeName} isn't able to leave you a reference right now`,
      react: ReferenceDeclinedEmail({ candidateName, refereeName }),
    })

    if (error) {
      console.error('Failed to send reference declined notice:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send reference declined notice:', error)
    return { sent: false as const }
  }
}
