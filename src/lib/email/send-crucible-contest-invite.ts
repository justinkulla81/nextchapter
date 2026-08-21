import 'server-only'
import { Resend } from 'resend'
import CrucibleContestInviteEmail from '@/emails/crucible-contest-invite'

// Same guard-on-RESEND_API_KEY + try/catch-never-throws shape as
// send-market-reality-report.ts. The `from` domain is still
// launchyournextchapter.com — it's the only domain verified in Resend
// today (a dedicated noexperienceneeded.ai domain hasn't been set up) —
// but the visible sender NAME reads as noexperienceneeded.ai, so this
// never looks like a NextChapter email to the candidate.
export async function sendCrucibleContestInviteEmail(
  email: string,
  companyName: string,
  contestTitle: string,
  entryUrl: string
): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping contest invite email.')
    return { sent: false }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'noexperienceneeded.ai <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: `${companyName} wants your take on a real problem`,
      react: CrucibleContestInviteEmail({ companyName, contestTitle, entryUrl }),
    })

    if (error) {
      console.error('Failed to send contest invite email:', error)
      return { sent: false }
    }
    return { sent: true }
  } catch (error) {
    console.error('Failed to send contest invite email:', error)
    return { sent: false }
  }
}
