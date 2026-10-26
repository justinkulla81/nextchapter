import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { maskEmail } from '@/lib/auth/recent-auth'

// The single-use email for "Link my other account" (src/lib/employer/account-link.ts). It goes to the address being
// linked, so opening it is the proof that the person controls that inbox. Our own mail; nothing is written to anyone's
// Google account.
export async function sendAccountLinkEmail({ to, url, requesterEmail, minutes }: { to: string; url: string; requesterEmail: string | null; minutes: number }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping the account link email.')
    return false
  }
  const who = requesterEmail ? `the NextChapter account ${maskEmail(requesterEmail)}` : 'another NextChapter account'
  const text = [
    `Someone signed in to ${who} asked to link it with this address, so one person can open the employer sections of both from one page.`,
    '',
    `To confirm, open this link while you are signed in to ${who}. It works once and expires in ${minutes} minutes:`,
    url,
    '',
    'Linking does not merge the accounts, change any role, or give anyone new access. Either account can remove the link later.',
    '',
    'If you did not expect this, ignore this email and nothing happens.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Someone signed in to ${who} asked to link it with this address, so one person can open the employer sections of both from one page.</p>
<p>To confirm, open this link while you are signed in to ${who}. It works once and expires in ${minutes} minutes.</p>
<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Confirm the link</a></p>
<p style="color:#555;font-size:14px">Linking does not merge the accounts, change any role, or give anyone new access. Either account can remove the link later. If you did not expect this, ignore this email and nothing happens.</p>
</div>`
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to,
      subject: 'Confirm linking your NextChapter accounts',
      html,
      text,
    })
    if (error) {
      console.error('Account link email failed:', error.message)
      return false
    }
    return true
  } catch (error) {
    console.error('Account link email failed:', error instanceof Error ? error.message : error)
    return false
  }
}
