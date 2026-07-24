import 'server-only'
import { Resend } from 'resend'
import RecruiterCandidateInviteEmail from '@/emails/recruiter-candidate-invite'

export async function sendRecruiterCandidateInviteEmail(
  invitedEmail: string,
  recruiterName: string,
  firmName: string | null,
  acceptUrl: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping recruiter candidate invite email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: invitedEmail,
      subject: `${recruiterName} wants to work with you on NextChapter`,
      react: RecruiterCandidateInviteEmail({ recruiterName, firmName, acceptUrl }),
    })

    if (error) {
      console.error('Failed to send recruiter candidate invite email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send recruiter candidate invite email:', error)
    return { sent: false as const }
  }
}
