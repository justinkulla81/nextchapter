import 'server-only'
import { Resend } from 'resend'
import NewMessageNotificationEmail from '@/emails/new-message-notification'

export async function sendNewMessageNotification({
  toEmail,
  recipientFirstName,
  senderName,
  threadPath,
}: {
  toEmail: string
  recipientFirstName: string | null
  senderName: string
  threadPath: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping new message notification email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const threadUrl = `${appUrl}${threadPath}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: toEmail,
      subject: `New message from ${senderName}`,
      react: NewMessageNotificationEmail({ recipientFirstName, senderName, threadUrl }),
    })

    if (error) {
      console.error('Failed to send new message notification email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break message sending itself.
    console.error('Failed to send new message notification email:', error)
    return { sent: false as const }
  }
}
