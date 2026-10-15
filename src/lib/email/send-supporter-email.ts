import 'server-only'
import { createResend } from '@/lib/email/resend-client'

const FROM = 'NextChapter <support@launchyournextchapter.com>'
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping supporter email.')
    return false
  }
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({ from: FROM, to, subject, html })
    if (error) console.error('Failed to send supporter email:', error)
    return !error
  } catch (error) {
    console.error('Failed to send supporter email:', error)
    return false
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const shell = (body: string) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0a0a0a"><p style="font-size:20px;font-weight:700;color:#0b2545">NextChapter</p>${body}</div>`

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#2e7d5b;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`

export async function sendSupporterInviteEmail(p: { to: string; supporterName: string; memberFirstName: string; token: string }) {
  const url = `${appUrl()}/supporter/${p.token}`
  return send(
    p.to,
    `${p.memberFirstName} asked you to cheer them on`,
    shell(
      `<p>Hi ${esc(p.supporterName)},</p><p>${esc(p.memberFirstName)} is looking for their next role and asked you to be their supporter. You will get one short note a week about how it is going (effort only, nothing private), and you can send a cheer any time.</p>${button(url, 'See how they are doing')}<p style="color:#485872;font-size:13px">You do not need an account. ${esc(p.memberFirstName)} can remove you at any time.</p>`
    )
  )
}

export async function sendSupporterDigestEmail(p: { to: string; supporterName: string; headline: string; token: string; stats: Array<[string, number]> }) {
  const url = `${appUrl()}/supporter/${p.token}`
  const rows = p.stats.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#485872">${esc(k)}</td><td style="font-weight:600">${v}</td></tr>`).join('')
  return send(
    p.to,
    'Your weekly note on how the search is going',
    shell(`<p>Hi ${esc(p.supporterName)},</p><p>${esc(p.headline)}</p><table>${rows}</table>${button(url, 'Send a cheer')}`)
  )
}
