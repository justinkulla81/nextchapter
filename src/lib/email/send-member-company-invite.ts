import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import MemberCompanyInviteEmail from '@/emails/member-company-invite'

export async function sendMemberCompanyInviteEmail(to: string, orgName: string, companyName: string, acceptUrl: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping member company invite email.')
    return { sent: false as const }
  }
  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `${orgName} gave ${companyName} access to local job seekers`,
      react: MemberCompanyInviteEmail({ orgName, companyName, acceptUrl }),
    })
    if (error) {
      console.error('Failed to send member company invite email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send member company invite email:', error)
    return { sent: false as const }
  }
}
