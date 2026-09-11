import 'server-only'
import { Resend } from 'resend'

/**
 * Sends one CRM broadcast message.
 *
 * Plain text rather than a React template on purpose: a CRM update is a note
 * from a person, and a branded marketing shell is exactly the wrong register
 * for "here's where we got to this month" going to an investor you know.
 */
export async function sendCrmBroadcastEmail({
  to, subject, body, replyTo,
}: {
  to: string
  subject: string
  body: string
  replyTo?: string
}): Promise<{ sent: true } | { sent: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, error: 'RESEND_API_KEY is not set' }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: replyTo ?? 'support@launchyournextchapter.com',
      to,
      subject,
      text: body,
    })
    if (error) return { sent: false, error: error.message ?? 'Resend rejected the message' }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) }
  }
}
