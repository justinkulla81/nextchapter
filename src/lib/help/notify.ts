import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import type { EmailAudience } from '@/lib/email/audience-tag'
import { prisma } from '@/lib/prisma'
import { PORTAL_LABEL } from '@/lib/help/constants'
import { HELP_REPLY_PREFIX } from '@/lib/help/inbound-address'
import { INTAKE_FORWARD_DOMAIN } from '@/lib/recruiter/intake/constants'
import {
  buttonHtml, callout, conversationHistoryHtml, conversationHistoryText, emailDocument, escapeHtml, factsHtml, stamp, textToHtml,
  type ThreadMessage,
} from '@/lib/help/email-layout'

/** Where new help requests are emailed. Override with HELP_FORWARD_TO. */
const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'
const FROM = `NextChapter Support <${SUPPORT}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const ADMIN_URL = 'https://admin.launchyournextchapter.com'

/** Replies to our emails come back here and are filed in the same conversation (see lib/help/inbound). */
// Off until the inbound domain's DNS and webhook are live; until then a reply goes to the support@ inbox.
const replyAddress = (requestId: string) =>
  process.env.HELP_INBOUND_ENABLED === '1' ? `${HELP_REPLY_PREFIX}${requestId}@${INTAKE_FORWARD_DOMAIN}` : SUPPORT

const PORTAL_AUDIENCE: Record<string, EmailAudience> = {
  CANDIDATE: 'candidate', PUBLIC: 'general', EMPLOYER: 'employer', RECRUITER: 'recruiter', COACH: 'coach', INSTITUTION: 'organization',
}

async function send(args: { to: string; subject: string; html: string; text: string; replyTo?: string; audience: EmailAudience; ref?: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping help email.')
    return false
  }
  const { audience, ref, ...mail } = args
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, audience).emails.send({
      from: FROM,
      // One conversation, one thread: mail clients group on these.
      ...(ref ? { headers: { References: `<help-${ref}@launchyournextchapter.com>`, 'X-Entity-Ref-ID': ref } } : {}),
      ...mail,
    })
    if (error) { console.error('Help email failed:', error); return false }
    return true
  } catch (e) {
    console.error('Help email failed:', e)
    return false
  }
}

const candidateName = (c: { firstName: string | null; lastName: string | null } | null) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'A candidate'

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Every message in a conversation, oldest first, for quoting under the newest. */
async function thread(requestId: string): Promise<ThreadMessage[]> {
  const rows = await prisma.helpMessage.findMany({ where: { requestId }, orderBy: { createdAt: 'asc' }, select: { fromAdmin: true, body: true, createdAt: true } })
  return rows.map((m) => ({ fromTeam: m.fromAdmin, body: m.body, at: m.createdAt }))
}

/** The internal alert: who, where, the message, and one button into the Help inbox. */
async function alertAdmin(r: {
  id: string; subject: string; kind: 'HELP' | 'PROBLEM'; portal: string; flaggedCrisis: boolean; contextTitle: string | null; contextPath: string | null; createdAt: Date
}, who: { name: string; email: string | null; org: string | null }, body: string, isFollowUp: boolean): Promise<void> {
  const kind = r.kind === 'PROBLEM' ? 'Problem' : 'Help request'
  const where = PORTAL_LABEL[r.portal] ?? r.portal
  const link = `${ADMIN_URL}/support/admin/help/${r.id}`
  const history = (await thread(r.id)).slice(0, -1)
  const page = [r.contextTitle, r.contextPath].filter(Boolean).join(' · ')
  const flag = r.flaggedCrisis ? '[Check in] ' : ''
  const title = isFollowUp ? `${who.name} replied` : `New ${kind.toLowerCase()} from ${who.name}`
  const html = emailDocument({
    preheader: clip(body, 110),
    label: 'Help inbox',
    footer: `You are getting this because you run support. <a href="${link}" style="color:#1d4e89">Open the conversation</a>.`,
    bodyHtml: `
      ${r.flaggedCrisis ? callout('<strong>Check in first.</strong> This message uses crisis language. They were shown the 988 Suicide &amp; Crisis Lifeline when sending.', 'alert') : ''}
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3">${escapeHtml(title)}</p>
      ${factsHtml([['From', who.name], ['Email', who.email], ['Portal', where + (who.org ? ` · ${who.org}` : '')], ['Type', isFollowUp ? 'Follow-up' : kind], ['Page', page || null], ['Sent', stamp(new Date())]])}
      <div style="margin:0 0 20px;padding:14px 16px;background:#f7f9fb;border-left:3px solid #f4a259;border-radius:4px">${textToHtml(body, 'margin:0 0 10px;font-size:15px;line-height:1.6;color:#0f1b2b')}</div>
      ${buttonHtml('Reply in the Help inbox', link)}`,
    history: conversationHistoryHtml(history, who.name),
  })
  const text = `${title}\n\n${[['From', who.name], ['Email', who.email], ['Portal', where + (who.org ? ` · ${who.org}` : '')], ['Page', page || null]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${body}\n\nReply: ${link}${conversationHistoryText(history, who.name)}`
  await send({ to: ADMIN_TO, subject: `${flag}${where}: ${who.name} · ${r.subject}`, html, text, audience: 'admin', ref: r.id })
}

/** A new help request or problem, or a candidate's follow-up on one: email the admin. */
export async function notifyAdminOfHelp(requestId: string, body: string, isFollowUp: boolean): Promise<void> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId } })
  if (!r?.candidateId) return
  const c = await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { firstName: true, lastName: true, email: true } })
  await alertAdmin(r, { name: candidateName(c), email: c?.email ?? null, org: null }, body, isFollowUp)
}

/** A new help request or problem from a partner portal (employer, recruiter, coach, institution): email the admin. */
export async function notifyAdminOfPortalHelp(requestId: string, body: string): Promise<void> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId } })
  if (!r) return
  await alertAdmin(r, { name: r.requesterName || PORTAL_LABEL[r.portal] || 'Partner user', email: r.requesterEmail, org: r.requesterOrg }, body, false)
}

/** Someone answered our email: tell the admin, or flag a reply from an address that is not theirs. */
export async function notifyAdminOfHelpReply(requestId: string, body: string, fromEmail: string, mismatch: boolean): Promise<void> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId } })
  if (!r) return
  const c = r.candidateId ? await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { firstName: true, lastName: true, email: true } }) : null
  const who = r.candidateId ? { name: candidateName(c), email: c?.email ?? null, org: null } : { name: r.requesterName || PORTAL_LABEL[r.portal] || 'Customer', email: r.requesterEmail, org: r.requesterOrg }
  if (!mismatch) return alertAdmin(r, who, body, true)
  const link = `${ADMIN_URL}/support/admin/help/${r.id}`
  const html = emailDocument({
    preheader: `A reply from ${fromEmail} was not filed.`,
    label: 'Help inbox',
    bodyHtml: `
      ${callout(`<strong>Not added to the conversation.</strong> This reply came from <strong>${escapeHtml(fromEmail)}</strong>, not from ${escapeHtml(who.email ?? 'the person who wrote in')}. Read it, then reply in the Help inbox if it is theirs.`, 'alert')}
      <p style="margin:0 0 16px;font-size:18px;font-weight:700">${escapeHtml(r.subject)}</p>
      <div style="margin:0 0 20px;padding:14px 16px;background:#f7f9fb;border-left:3px solid #f4a259;border-radius:4px">${textToHtml(body)}</div>
      ${buttonHtml('Open the conversation', link)}`,
  })
  await send({ to: ADMIN_TO, subject: `Reply not filed: ${r.subject}`, html, text: `Reply from ${fromEmail} was not added (expected ${who.email ?? 'unknown'}).\n\n${body}\n\n${link}`, audience: 'admin', ref: r.id })
}

/** A reply arrived but its body could not be read (receiving key missing): tell the admin so it is not lost. */
export async function notifyHelpReplyUnreadable(requestId: string, fromEmail: string, subject: string | null): Promise<void> {
  const link = `${ADMIN_URL}/support/admin/help/${requestId}`
  const html = emailDocument({
    preheader: `A reply from ${fromEmail} could not be read.`,
    label: 'Help inbox',
    bodyHtml: `
      ${callout(`<strong>A reply arrived but could not be read.</strong> It is from <strong>${escapeHtml(fromEmail)}</strong>${subject ? ` (“${escapeHtml(subject)}”)` : ''}. Open it in Resend → Emails → Received, and set <code>RESEND_RECEIVING_API_KEY</code> so replies file automatically.`, 'alert')}
      ${buttonHtml('Open the conversation', link)}`,
  })
  await send({ to: ADMIN_TO, subject: 'Help reply could not be read', html, text: `A reply from ${fromEmail} could not be read. Open it in Resend (Emails → Received) and set RESEND_RECEIVING_API_KEY.\n\n${link}`, audience: 'admin' })
}

/** The admin replied: email the person with the reply, the conversation so far, and a way back. */
export async function notifyCandidateOfReply(requestId: string, body: string): Promise<boolean> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId }, select: { candidateId: true, portal: true, subject: true, requesterName: true, requesterEmail: true } })
  if (!r) return false
  let to: string | null
  let first: string | null
  let inApp: boolean
  if (r.candidateId) {
    const c = await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { firstName: true, email: true } })
    to = c?.email ?? null
    first = c?.firstName ?? null
    inApp = true
  } else {
    // Partner-portal people have no in-app inbox: they answer by replying to the email, which lands in support@.
    to = r.requesterEmail
    first = r.requesterName?.split(' ')[0] ?? null
    inApp = false
  }
  if (!to) return false
  const history = (await thread(requestId)).slice(0, -1)
  const link = `${APP_URL}/dashboard/help?request=${requestId}`
  const html = emailDocument({
    preheader: clip(body, 110),
    label: 'Support',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.65">${first ? `Hi ${escapeHtml(first)},` : 'Hello,'}</p>
      ${textToHtml(body)}
      <p style="margin:18px 0 20px;font-size:16px;line-height:1.65">Thanks,<br><strong>The NextChapter team</strong></p>
      ${inApp ? buttonHtml('Reply on NextChapter', link) : `<p style="margin:0 0 6px;font-size:14px;color:#55606e">To reply, just answer this email. It comes straight to us.</p>`}`,
    history: conversationHistoryHtml(history, 'You'),
  })
  const text = `${first ? `Hi ${first},` : 'Hello,'}\n\n${body}\n\nThanks,\nThe NextChapter team\n\n${inApp ? `Reply on NextChapter: ${link}` : 'To reply, just answer this email. It comes straight to us.'}${conversationHistoryText(history, 'You')}`
  return send({ to, subject: `Re: ${r.subject}`, replyTo: replyAddress(requestId), html, text, audience: PORTAL_AUDIENCE[r.portal] ?? 'candidate', ref: requestId })
}

/**
 * An idea or feedback was marked Addressed with a note: tell the person what
 * happened. Candidates (in-app) and partner-portal senders (employer, recruiter,
 * coach, institution, reached at the email they were signed in with) both get it.
 * Only ever sent when you wrote a note.
 */
export async function notifyFeedbackAddressed(feedbackId: string): Promise<boolean> {
  const fb = await prisma.productFeedback.findUnique({
    where: { id: feedbackId },
    select: { candidateId: true, contactEmail: true, source: true, personLabel: true, channel: true, rawText: true, responseNote: true },
  })
  if (!fb?.responseNote) return false
  // A problem report sent to Vision was already answered in its conversation.
  if (fb.channel === 'in-app problem') return false

  let to: string | null = null
  let first: string | null = null
  let audience: EmailAudience = 'candidate'
  let link = `${APP_URL}/dashboard/help`
  if (fb.candidateId && fb.channel?.startsWith('in-app')) {
    const c = await prisma.candidateProfile.findUnique({ where: { id: fb.candidateId }, select: { firstName: true, email: true } })
    to = c?.email ?? null
    first = c?.firstName ?? null
  } else if (fb.channel?.startsWith('portal') && fb.contactEmail) {
    to = fb.contactEmail
    first = fb.personLabel?.split(' ')[0] ?? null
    audience = ({ EMPLOYER: 'employer', RECRUITER: 'recruiter', COACH: 'coach' } as Record<string, EmailAudience>)[fb.source] ?? 'organization'
    // They have no ideas list in the portal: the email stands on its own.
    link = ''
  }
  if (!to) return false

  const what = fb.channel?.endsWith('idea') ? 'idea' : 'feedback'
  const excerpt = clip(fb.rawText, 240)
  const html = emailDocument({
    preheader: `An update on the ${what} you sent us.`,
    label: 'Support',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.65">${first ? `Hi ${escapeHtml(first)},` : 'Hello,'}</p>
      <p style="margin:0 0 14px;font-size:16px;line-height:1.65">Thank you for your ${what}. Here is what happened with it.</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#55606e">What you told us</p>
      <div style="margin:0 0 18px;border-left:3px solid #e3e8ef;padding:2px 0 2px 12px;font-size:14px;line-height:1.55;color:#55606e;white-space:pre-wrap">${escapeHtml(excerpt)}</div>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#1d4e89">Our response</p>
      ${textToHtml(fb.responseNote)}
      <p style="margin:18px 0 ${link ? '20px' : '4px'};font-size:16px;line-height:1.65">Thanks,<br><strong>The NextChapter team</strong></p>
      ${link ? buttonHtml('See your ideas and feedback', link) : '<p style="margin:0;font-size:14px;color:#55606e">Reply to this email any time. It comes straight to us.</p>'}`,
  })
  const text = `${first ? `Hi ${first},` : 'Hello,'}\n\nThank you for your ${what}. Here is what happened with it.\n\nWhat you told us:\n${excerpt}\n\nOur response:\n${fb.responseNote}\n\nThanks,\nThe NextChapter team\n\n${link || 'Reply to this email any time. It comes straight to us.'}`
  return send({ to, subject: `An update on your ${what}`, replyTo: SUPPORT, html, text, audience })
}

/** Yesterday's in-app ideas and feedback, in one email. Nothing sent when there are none. */
export async function sendDailyFeedbackDigest(since: Date): Promise<number> {
  const items = await prisma.productFeedback.findMany({
    where: { channel: { in: ['in-app idea', 'in-app feedback', 'portal idea', 'portal feedback'] }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, rawText: true, channel: true, contextPath: true, personLabel: true, createdAt: true, candidate: { select: { firstName: true, lastName: true } } },
  })
  if (items.length === 0) return 0
  const link = `${ADMIN_URL}/support/admin/help?tab=ideas`
  const cards = items.map((i) => {
    const who = i.personLabel ?? candidateName(i.candidate)
    const what = i.channel?.endsWith('idea') ? 'Idea' : 'Feedback'
    const partner = i.channel?.startsWith('portal')
    return {
      what, who, partner, text: i.rawText, path: i.contextPath, at: i.createdAt,
      html: `
        <div style="margin:0 0 14px;padding:14px 16px;border:1px solid #e3e8ef;border-radius:8px">
          <p style="margin:0 0 8px;font-size:12px;color:#55606e"><strong style="color:#0f1b2b">${what}</strong> · ${escapeHtml(who)}${partner ? ' · partner portal' : ''} · ${stamp(i.createdAt)}</p>
          ${textToHtml(i.rawText, 'margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f1b2b')}
          ${i.contextPath ? `<p style="margin:0;font-size:12px;color:#55606e">From ${escapeHtml(i.contextPath)}</p>` : ''}
        </div>`,
    }
  })
  const n = items.length
  const html = emailDocument({
    preheader: `${n} new ${n === 1 ? 'idea or piece of feedback' : 'ideas and feedback'} in the last day.`,
    label: 'Ideas & feedback',
    footer: `Daily summary. <a href="${link}" style="color:#1d4e89">Open Ideas &amp; feedback</a> in the Help inbox, or triage in Vision → Feedback.`,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3">${n} new ${n === 1 ? 'idea or piece of feedback' : 'ideas and feedback'}</p>
      <p style="margin:0 0 18px;font-size:14px;color:#55606e">From candidates and partners in the last day.</p>
      ${cards.map((c) => c.html).join('')}
      ${buttonHtml('Open Ideas & feedback', link)}`,
  })
  const text = `${n} new ${n === 1 ? 'idea or piece of feedback' : 'ideas and feedback'} from candidates and partners in the last day\n\n${cards.map((c) => `${c.what} · ${c.who} · ${stamp(c.at)}\n${c.text}`).join('\n\n')}\n\nOpen: ${link}`
  await send({ to: ADMIN_TO, subject: `${n} new ${n === 1 ? 'idea or piece of feedback' : 'ideas and feedback'} from customers`, html, text, audience: 'admin' })
  return n
}
