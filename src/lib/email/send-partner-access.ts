import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import PartnerAccessEmail from '@/emails/partner-access'

export async function sendPartnerAccessEmail(to: string, orgName: string, partnerName: string, acceptUrl: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping partner access email.')
    return { sent: false as const }
  }
  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `${orgName} gave ${partnerName} a page in its talent network`,
      react: PartnerAccessEmail({ orgName, partnerName, acceptUrl }),
    })
    if (error) {
      console.error('Failed to send partner access email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send partner access email:', error)
    return { sent: false as const }
  }
}
