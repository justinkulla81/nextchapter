import 'server-only'
import { createResend } from '@/lib/email/resend-client'

const FROM = 'NextChapter <support@launchyournextchapter.com>'
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function sendPartnerInviteEmail(p: { to: string; partnerName: string; memberFirstName: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping partner invite email.')
    return false
  }
  const url = `${appUrl()}/dashboard/move-plan`
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0a0a0a"><p style="font-size:20px;font-weight:700;color:#0b2545">NextChapter</p><p>Hi ${esc(p.partnerName)},</p><p>${esc(p.memberFirstName)} invited you to search together on NextChapter. You get your own free account and your own search. You also see the places you may move to, and what it costs to live there.</p><p><a href="${url}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#2e7d5b;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600">Join ${esc(p.memberFirstName)}’s search</a></p><p style="color:#485872;font-size:13px">Sign in or create an account with this email address, ${esc(p.to)}, so the invitation finds you. ${esc(p.memberFirstName)} can remove you at any time, and you can leave at any time.</p></div>`
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({ from: FROM, to: p.to, subject: `${p.memberFirstName} invited you to search together`, html })
    if (error) console.error('Failed to send partner invite email:', error)
    return !error
  } catch (error) {
    console.error('Failed to send partner invite email:', error)
    return false
  }
}
