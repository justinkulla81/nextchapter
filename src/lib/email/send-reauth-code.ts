import 'server-only'
import { createResend } from '@/lib/email/resend-client'

// The one-time code for confirming an irreversible account action (see
// src/lib/auth/reauth.ts). The code itself is Supabase's own email OTP; we only
// deliver it, so the wording is ours and stays the same whatever the Supabase
// email templates say.
export async function sendReauthCodeEmail({ to, code, actionLabel }: { to: string; code: string; actionLabel: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping the confirmation code email.')
    return false
  }
  const text = [
    `Your NextChapter confirmation code is ${code}.`,
    '',
    `Enter it on the page where you asked to ${actionLabel}. It works once and expires within an hour.`,
    '',
    'If you did not ask for this, someone may know your password. Do not share the code, and change your password at https://launchyournextchapter.com/auth/forgot-password.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Your NextChapter confirmation code is</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:8px 0 16px">${code}</p>
<p>Enter it on the page where you asked to ${actionLabel}. It works once and expires within an hour.</p>
<p style="color:#555;font-size:14px">If you did not ask for this, someone may know your password. Do not share the code, and <a href="https://launchyournextchapter.com/auth/forgot-password">change your password</a>.</p>
</div>`
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to,
      subject: 'Your NextChapter confirmation code',
      html,
      text,
    })
    if (error) {
      console.error('Confirmation code email failed:', error.message)
      return false
    }
    return true
  } catch (error) {
    console.error('Confirmation code email failed:', error instanceof Error ? error.message : error)
    return false
  }
}
