import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { loadWeeklyRoundup } from './weekly-roundup-server'
import { windowLabel } from './weekly-roundup'

/** The team inbox, the same one help requests go to. */
const TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const FROM = 'NextChapter Support <support@launchyournextchapter.com>'
const PAGE = 'https://admin.launchyournextchapter.com/support/admin/layoff-roundup'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const block = (title: string, text: string) =>
  `<h2 style="margin:24px 0 8px;font-size:16px;color:#0f1b2b">${esc(title)}</h2><pre style="margin:0;white-space:pre-wrap;font:14px/1.6 Arial,sans-serif;color:#0f1b2b;background:#f4f6f9;padding:12px;border-radius:6px">${esc(text)}</pre>`

/** Emails the week's drafts to the team inbox. Returns whether one was sent: nothing goes out in a week with no filings and no press-reported cuts, or without a mail key. */
export async function sendWeeklyRoundupEmail(now: Date = new Date()): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping the weekly layoff roundup email.')
    return false
  }
  const { roundup: r, drafts } = await loadWeeklyRoundup(now)
  if (r.filings === 0 && r.reported.length === 0) return false
  const held = r.held.length ? `<p style="margin:16px 0 0;font-size:14px;color:#55606e"><strong>Left out, check before using:</strong> ${r.held.map((h) => `${esc(h.employer)} about ${h.workers.toLocaleString('en-US')} (${h.reason})`).join('; ')}.</p>` : ''
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f1b2b">
    <p style="margin:0 0 4px;font-size:20px;font-weight:700">Weekly layoff roundup: ${esc(windowLabel(r))}</p>
    <p style="margin:0;font-size:14px;color:#55606e">Drafts for you to copy. Nothing was posted or sent to anyone else. <a href="${PAGE}" style="color:#1d4e89">Open the page</a>.</p>
    ${held}${block('LinkedIn post', drafts.linkedin)}${block(`Email: ${drafts.emailSubject}`, drafts.emailBody)}${drafts.pitch ? block('Pitch for a reporter', drafts.pitch) : ''}
  </div>`
  const text = [`Weekly layoff roundup: ${windowLabel(r)}`, '', 'LinkedIn post', drafts.linkedin, '', `Email: ${drafts.emailSubject}`, drafts.emailBody, ...(drafts.pitch ? ['', 'Pitch for a reporter', drafts.pitch] : []), '', PAGE].join('\n')
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: FROM, to: TO, subject: `Weekly layoff roundup: ${windowLabel(r)}`, html, text })
  if (error) throw new Error(`Roundup email failed: ${error.message}`)
  return true
}
