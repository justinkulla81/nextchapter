import 'server-only'
import { Resend } from 'resend'
import GuideDeliveryEmail from '@/emails/guide-delivery'

export async function sendGuideDeliveryEmail(email: string, firstName: string | null, guideTitle: string, guideSlug: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping guide delivery email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: email,
      subject: `Your guide: ${guideTitle}`,
      react: GuideDeliveryEmail({
        firstName,
        guideTitle,
        downloadUrl: `https://launchyournextchapter.com/guides/${guideSlug}.pdf`,
      }),
    })

    if (error) {
      console.error('Failed to send guide delivery email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break the calling action.
    console.error('Failed to send guide delivery email:', error)
    return { sent: false as const }
  }
}
