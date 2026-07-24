import 'server-only'
import { Resend } from 'resend'
import PrHookAlertEmail from '@/emails/pr-hook-alert'
import { getResearchLibraryAlertEmail } from '@/lib/admin/auth'

export async function sendPrHookAlertEmail(item: {
  title: string | null
  url: string
  summary: string | null
  suggestedAction: string | null
}) {
  const to = getResearchLibraryAlertEmail()
  if (!to) {
    console.warn('No admin email configured — skipping PR/media hook alert.')
    return { sent: false as const }
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping PR/media hook alert.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `PR hook: ${item.title || item.url}`,
      react: PrHookAlertEmail(item),
    })

    if (error) {
      console.error('Failed to send PR hook alert email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Delivery failure must never break research ingestion.
    console.error('Failed to send PR hook alert email:', error)
    return { sent: false as const }
  }
}
