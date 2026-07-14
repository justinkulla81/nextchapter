import 'server-only'
import { Resend } from 'resend'
import PostInterestNotificationEmail from '@/emails/post-interest-notification'

export async function sendPostInterestNotification({
  posterEmail,
  postTitle,
  interestedCandidateName,
  interestedCandidateEmail,
}: {
  posterEmail: string
  postTitle: string
  interestedCandidateName: string
  interestedCandidateEmail: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping post interest notification email.')
    return { sent: false as const }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <hello@launchyournextchapter.com>',
      replyTo: interestedCandidateEmail,
      to: posterEmail,
      subject: `Someone is interested in your Community Board post`,
      react: PostInterestNotificationEmail({ postTitle, interestedCandidateName, interestedCandidateEmail }),
    })

    if (error) {
      console.error('Failed to send post interest notification email:', error)
      return { sent: false as const }
    }

    return { sent: true as const }
  } catch (error) {
    // Email delivery must never break the interest-expressing action.
    console.error('Failed to send post interest notification email:', error)
    return { sent: false as const }
  }
}
