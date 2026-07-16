import 'server-only'
import { Resend } from 'resend'
import ResumeLeadConfirmationEmail from '@/emails/resume-lead-confirmation'

export async function sendResumeLeadConfirmationEmail(email: string, fullName: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping resume lead confirmation email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: email,
      subject: 'We got your resume',
      react: ResumeLeadConfirmationEmail({ fullName }),
    })

    if (error) {
      console.error('Failed to send resume lead confirmation email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send resume lead confirmation email:', error)
    return { sent: false as const }
  }
}
