import 'server-only'
import { Resend } from 'resend'
import LayoffContextAlertEmail from '@/emails/layoff-context-alert'
import { getResearchLibraryAlertEmail } from '@/lib/admin/auth'

// Same immediate-notification mechanism as sendPrHookAlertEmail (Prompt
// 64) — reused rather than building a second alert channel, per Prompt
// 65 section 5's "reuse that mechanism rather than building a new one."
export async function sendLayoffContextAlertEmail(item: {
  submitterName: string
  submitterCompany: string
  submitterEmail: string
  employeeName: string
  employeeEmail: string
}) {
  const to = getResearchLibraryAlertEmail()
  if (!to) {
    console.warn('No admin email configured — skipping layoff-context alert.')
    return { sent: false as const }
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping layoff-context alert.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `Layoff signal: ${item.submitterCompany} (via ${item.submitterName})`,
      react: LayoffContextAlertEmail(item),
    })

    if (error) {
      console.error('Failed to send layoff-context alert email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Delivery failure must never break the employer's submission.
    console.error('Failed to send layoff-context alert email:', error)
    return { sent: false as const }
  }
}
