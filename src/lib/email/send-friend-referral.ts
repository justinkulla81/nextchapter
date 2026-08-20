import 'server-only'
import { Resend } from 'resend'
import FriendReferralEmail from '@/emails/friend-referral'

export async function sendFriendReferralEmail({
  friendEmail,
  referrerEmail,
}: {
  friendEmail: string
  referrerEmail: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping friend referral email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: friendEmail,
      subject: `${referrerEmail} thought you'd want to see this`,
      react: FriendReferralEmail({ referrerEmail }),
    })

    if (error) {
      console.error('Failed to send friend referral email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send friend referral email:', error)
    return { sent: false as const }
  }
}
