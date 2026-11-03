import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'

const FROM = 'NextChapter <support@launchyournextchapter.com>'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const shell = (body: string) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0a0a0a"><p style="font-size:20px;font-weight:700;color:#0b2545">NextChapter</p>${body}</div>`

/** The one-time link that confirms the email behind a layoff story, with the link that withdraws it. */
export async function sendLayoffStoryLinkEmail(p: { to: string; companyName: string; verifyUrl: string; withdrawUrl: string; days: number; publishing: boolean }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping layoff story link email.')
    return false
  }
  const what = p.publishing
    ? 'A person on our team reads a story before it is shown, and your email is never shown.'
    : 'Your answers are counted in the numbers for the company. Nothing from you is shown.'
  const html = shell(
    `<p>Thanks for sharing what happened at ${esc(p.companyName)}.</p><p>Confirm this email address so your answers count. ${what}</p><p><a href="${esc(p.verifyUrl)}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#2e7d5b;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600">Confirm my email</a></p><p style="color:#485872;font-size:13px">The link works once and expires in ${p.days} days. If it was not you, ignore this email and nothing happens.</p><p style="color:#485872;font-size:13px">Changed your mind? <a href="${esc(p.withdrawUrl)}" style="color:#485872">Delete my story</a> at any time. This removes what you wrote and your email.</p>`,
  )
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({ from: FROM, to: p.to, subject: `Confirm your ${p.companyName} layoff story`, html: withAudienceHtml('candidate', html) })
    if (error) console.error('Failed to send layoff story link email:', error)
    return !error
  } catch (error) {
    console.error('Failed to send layoff story link email:', error)
    return false
  }
}
