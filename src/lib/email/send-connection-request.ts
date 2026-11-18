import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import ConnectionRequestEmail from '@/emails/connection-request'

export async function sendConnectionRequestEmail(args: { to: string; fromName: string; fromLabel: string; toName: string; url: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping connection request email.')
    return { sent: false as const }
  }
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: args.to,
      subject: `${args.fromName} asked to connect with ${args.toName}`,
      react: ConnectionRequestEmail(args),
    })
    if (error) {
      console.error('Failed to send connection request email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send connection request email:', error)
    return { sent: false as const }
  }
}
