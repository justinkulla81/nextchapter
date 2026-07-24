import 'server-only'
import { Resend } from 'resend'
import ProductPositioningFlagEmail from '@/emails/product-positioning-flag'
import { getResearchLibraryAlertEmail } from '@/lib/admin/auth'

export async function sendProductPositioningFlagEmail(item: {
  title: string | null
  url: string
  summary: string | null
  suggestedAction: string | null
}) {
  const to = getResearchLibraryAlertEmail()
  if (!to) {
    console.warn('No admin email configured — skipping product-positioning flag.')
    return { sent: false as const }
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping product-positioning flag.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to,
      subject: `Product-positioning research: ${item.title || item.url}`,
      react: ProductPositioningFlagEmail(item),
    })

    if (error) {
      console.error('Failed to send product-positioning flag email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send product-positioning flag email:', error)
    return { sent: false as const }
  }
}
