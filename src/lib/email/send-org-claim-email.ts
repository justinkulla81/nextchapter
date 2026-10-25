import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'

const FROM = 'NextChapter <support@launchyournextchapter.com>'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const shell = (body: string) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0a0a0a"><p style="font-size:20px;font-weight:700;color:#0b2545">NextChapter</p>${body}</div>`

async function send(audience: 'organization' | 'admin', to: string, subject: string, html: string, label: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY is not set — skipping ${label} email.`)
    return false
  }
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, audience).emails.send({ from: FROM, to, subject, html: withAudienceHtml(audience, html) })
    if (error) console.error(`Failed to send ${label} email:`, error)
    return !error
  } catch (error) {
    console.error(`Failed to send ${label} email:`, error)
    return false
  }
}

/** The one-time link to the claimant's work address. */
export function sendOrgClaimLinkEmail(p: { to: string; name: string; orgName: string; verifyUrl: string; days: number }): Promise<boolean> {
  return send(
    'organization', p.to, `Confirm your claim on the ${p.orgName} page`,
    shell(
      `<p>Hi ${esc(p.name)},</p><p>Someone asked to claim the ${esc(p.orgName)} page on NextChapter with this email address. To confirm it was you, use the button below.</p><p><a href="${esc(p.verifyUrl)}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:#2e7d5b;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600">Confirm my claim</a></p><p style="color:#485872;font-size:13px">The link works once and expires in ${p.days} days. If it was not you, ignore this email and nothing happens.</p>`,
    ),
    'organization claim link',
  )
}

/** To the section's existing admins when a later person verifies a work email and asks for the same section. Grants nothing. */
export function sendSectionClaimRequestEmail(p: { to: string; orgName: string; sectionLabel: string; name: string; title: string; email: string }): Promise<boolean> {
  return send(
    'organization', p.to, `${p.name} asked for access to ${p.sectionLabel} at ${p.orgName}`,
    shell(
      `<p>${esc(p.name)} (${esc(p.title)}, ${esc(p.email)}) confirmed a work email at your organization and asked for access to the ${esc(p.sectionLabel)} section of ${esc(p.orgName)} on NextChapter.</p><p>Nothing was granted. If you know this person, add them from the Team page of the ${esc(p.sectionLabel)} section. If you do not, ignore this email.</p>`,
    ),
    'section claim request',
  )
}

/** To the team when a claim is verified. */
export function sendOrgClaimAdminEmail(p: { orgName: string; name: string; title: string; email: string; needsReview: boolean; pageUrl: string; section?: { label: string; outcome: string } }): Promise<boolean> {
  return send(
    'admin', 'justin@launchyournextchapter.com', `${p.orgName}: page claim verified${p.needsReview ? ' (needs review)' : ''}`,
    `<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#111"><p><b>${esc(p.name)}</b>, ${esc(p.title)}, ${esc(p.email)}, verified their work email and claimed the <b>${esc(p.orgName)}</b> page.</p>${p.section ? `<p>Section: <b>${esc(p.section.label)}</b>. ${p.section.outcome === 'admin' ? 'First claimant of this section, recorded as its administrator (no access until it is set up).' : p.section.outcome === 'requested' ? 'The section already has an administrator; the request was sent to them and nothing was granted.' : p.section.outcome === 'review' ? 'Held for review; nothing was created.' : ''}</p>` : ''}${p.needsReview ? '<p><b>Needs review:</b> we have no email domain on file for this organization, so the address could not be matched to it.</p>' : '<p>The address is at the organization&apos;s known domain.</p>'}<p>${esc(p.pageUrl)}</p><p>They are in the CRM as a P0 lead due today.</p></div>`,
    'organization claim admin',
  )
}
