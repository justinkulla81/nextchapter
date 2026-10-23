import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { PORTAL_LABEL } from '@/lib/help/constants'

/** Where new help requests are emailed. Override with HELP_FORWARD_TO. */
const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const ADMIN_URL = 'https://admin.launchyournextchapter.com'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function wrap(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0f1b2b;line-height:1.5">${inner}</div>`
}

const quote = (text: string) =>
  `<div style="white-space:pre-wrap;border-left:3px solid #f4a259;padding:4px 0 4px 12px;margin:0 0 16px">${escapeHtml(text)}</div>`

async function send(args: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping help email.')
    return false
  }
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, args.to === ADMIN_TO ? 'admin' : 'candidate').emails.send({ from: FROM, ...args })
    if (error) { console.error('Help email failed:', error); return false }
    return true
  } catch (e) {
    console.error('Help email failed:', e)
    return false
  }
}

const candidateName = (c: { firstName: string | null; lastName: string | null } | null) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'A candidate'

/** A new help request or problem, or a candidate's follow-up on one: email the admin. */
export async function notifyAdminOfHelp(requestId: string, body: string, isFollowUp: boolean): Promise<void> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId } })
  if (!r?.candidateId) return
  const c = await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { firstName: true, lastName: true, email: true } })
  const name = candidateName(c)
  const kind = r.kind === 'PROBLEM' ? 'Problem' : 'Help'
  const link = `${ADMIN_URL}/support/admin/help/${r.id}`
  const flag = r.flaggedCrisis ? '[Check in] ' : ''
  await send({
    to: ADMIN_TO,
    subject: `${flag}${isFollowUp ? 'Reply' : kind}: ${name} · ${r.subject}`,
    html: wrap(`
      ${r.flaggedCrisis ? '<p style="margin:0 0 12px;color:#9b3b2f;font-weight:600">This message uses crisis language. The candidate was shown the 988 line.</p>' : ''}
      <p style="margin:0 0 12px;font-size:17px;font-weight:600">${isFollowUp ? `${escapeHtml(name)} replied` : `${kind} request from ${escapeHtml(name)}`}</p>
      ${quote(body)}
      <p style="margin:0 0 4px;color:#55606e;font-size:13px">${r.contextTitle || r.contextPath ? `Page: ${escapeHtml(r.contextTitle || r.contextPath || '')}` : ''}</p>
      <p style="margin:0;font-size:14px"><a href="${link}">Reply in the Help inbox</a></p>`),
    text: `${isFollowUp ? `${name} replied` : `${kind} request from ${name}`}\n\n${body}\n\nReply: ${link}`,
  })
}

/** A new help request or problem from a partner portal (employer, recruiter, coach, institution): email the admin. */
export async function notifyAdminOfPortalHelp(requestId: string, body: string): Promise<void> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId } })
  if (!r) return
  const kind = r.kind === 'PROBLEM' ? 'Problem' : 'Help'
  const where = PORTAL_LABEL[r.portal] ?? r.portal
  const who = [r.requesterName, r.requesterOrg].filter(Boolean).join(' · ') || where
  const link = `${ADMIN_URL}/support/admin/help/${r.id}`
  const flag = r.flaggedCrisis ? '[Check in] ' : ''
  await send({
    to: ADMIN_TO,
    subject: `${flag}${where} ${kind.toLowerCase()}: ${who} · ${r.subject}`,
    html: wrap(`
      <p style="margin:0 0 12px;font-size:17px;font-weight:600">${kind} request from ${escapeHtml(who)} (${where} portal)</p>
      ${quote(body)}
      <p style="margin:0 0 4px;color:#55606e;font-size:13px">${r.contextTitle || r.contextPath ? `Page: ${escapeHtml(r.contextTitle || r.contextPath || '')}` : ''}</p>
      <p style="margin:0;font-size:14px"><a href="${link}">Reply in the Help inbox</a></p>`),
    text: `${kind} request from ${who} (${where} portal)\n\n${body}\n\nReply: ${link}`,
  })
}

/** The admin replied: email the candidate with the reply and a link back. */
export async function notifyCandidateOfReply(requestId: string, body: string): Promise<boolean> {
  const r = await prisma.helpRequest.findUnique({ where: { id: requestId }, select: { candidateId: true, subject: true, requesterName: true, requesterEmail: true } })
  if (!r) return false
  // Partner-portal requesters have no in-app inbox: the reply goes by email and
  // they answer by replying to it, which lands in support@.
  if (!r.candidateId) {
    if (!r.requesterEmail) return false
    const first = r.requesterName?.split(' ')[0]
    return send({
      to: r.requesterEmail,
      subject: `Re: ${r.subject}`,
      replyTo: 'support@launchyournextchapter.com',
      html: wrap(`
        <p style="margin:0 0 12px">Hi${first ? ` ${escapeHtml(first)}` : ''},</p>
        ${quote(body)}
        <p style="margin:0;font-size:14px;color:#55606e">Reply to this email and it comes straight to us.</p>`),
      text: `Hi${first ? ` ${first}` : ''},\n\n${body}\n\nReply to this email and it comes straight to us.`,
    })
  }
  const c = await prisma.candidateProfile.findUnique({ where: { id: r.candidateId }, select: { firstName: true, email: true } })
  if (!c?.email) return false
  const link = `${APP_URL}/dashboard/help?request=${requestId}`
  return send({
    to: c.email,
    subject: `Re: ${r.subject}`,
    html: wrap(`
      <p style="margin:0 0 12px">Hi${c.firstName ? ` ${escapeHtml(c.firstName)}` : ''},</p>
      ${quote(body)}
      <p style="margin:0;font-size:14px"><a href="${link}">Reply on NextChapter</a></p>`),
    text: `Hi${c.firstName ? ` ${c.firstName}` : ''},\n\n${body}\n\nReply on NextChapter: ${link}`,
  })
}

/** An in-app idea or feedback was marked Addressed with a note: tell the candidate. */
export async function notifyCandidateFeedbackAddressed(feedbackId: string): Promise<boolean> {
  const fb = await prisma.productFeedback.findUnique({
    where: { id: feedbackId },
    select: { candidateId: true, channel: true, rawText: true, responseNote: true },
  })
  if (!fb?.candidateId || !fb.responseNote || !fb.channel?.startsWith('in-app')) return false
  // A problem report sent to Vision was already answered in its conversation.
  if (fb.channel === 'in-app problem') return false
  const c = await prisma.candidateProfile.findUnique({ where: { id: fb.candidateId }, select: { firstName: true, email: true } })
  if (!c?.email) return false
  const what = fb.channel === 'in-app idea' ? 'idea' : 'feedback'
  const link = `${APP_URL}/dashboard/help`
  const excerpt = fb.rawText.length > 240 ? `${fb.rawText.slice(0, 239)}…` : fb.rawText
  return send({
    to: c.email,
    subject: `An update on your ${what}`,
    html: wrap(`
      <p style="margin:0 0 12px">Hi${c.firstName ? ` ${escapeHtml(c.firstName)}` : ''},</p>
      <p style="margin:0 0 8px">You told us:</p>
      ${quote(excerpt)}
      <p style="margin:0 0 8px">Here’s what happened:</p>
      ${quote(fb.responseNote)}
      <p style="margin:0;font-size:14px">Thank you. <a href="${link}">See all your ideas and feedback</a></p>`),
    text: `Hi${c.firstName ? ` ${c.firstName}` : ''},\n\nYou told us:\n${excerpt}\n\nHere's what happened:\n${fb.responseNote}\n\n${link}`,
  })
}

/** Yesterday's in-app ideas and feedback, in one email. Nothing sent when there are none. */
export async function sendDailyFeedbackDigest(since: Date): Promise<number> {
  const items = await prisma.productFeedback.findMany({
    where: { channel: { in: ['in-app idea', 'in-app feedback', 'portal idea', 'portal feedback'] }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, rawText: true, channel: true, contextPath: true, personLabel: true, candidate: { select: { firstName: true, lastName: true } } },
  })
  if (items.length === 0) return 0
  const link = `${ADMIN_URL}/support/admin/vision/feedback`
  const rows = items.map((i) => {
    const who = i.personLabel ?? candidateName(i.candidate)
    const what = i.channel?.endsWith('idea') ? 'Idea' : 'Feedback'
    return { html: `<p style="margin:0 0 4px;font-size:13px;color:#55606e">${what} · ${escapeHtml(who)}${i.contextPath ? ` · ${escapeHtml(i.contextPath)}` : ''}</p>${quote(i.rawText)}`, text: `${what} · ${who}\n${i.rawText}` }
  })
  await send({
    to: ADMIN_TO,
    subject: `${items.length} new ${items.length === 1 ? 'idea or piece of feedback' : 'ideas and feedback'} from customers`,
    html: wrap(`<p style="margin:0 0 14px;font-size:17px;font-weight:600">From candidates and partners in the last day</p>${rows.map((r) => r.html).join('')}<p style="margin:0;font-size:14px"><a href="${link}">Triage in Vision → Feedback</a></p>`),
    text: `${rows.map((r) => r.text).join('\n\n')}\n\nTriage: ${link}`,
  })
  return items.length
}
