import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { captureServerEvent } from '@/lib/posthog/server'
import type { ReplyClass } from './reply-class'

const SITE = 'https://launchyournextchapter.com'
const ALERT_TO = 'justin@launchyournextchapter.com'
/** Replies worth a same-day answer. An automatic reply or a plain no is logged but needs nothing. */
export const NEEDS_ANSWER: ReplyClass[] = ['positive', 'referral', 'question']
const LABEL: Record<string, string> = { positive: 'interested', referral: 'points to someone else', question: 'has a question' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A reply to cold outreach that needs an answer: the person goes on the People follow-ups list for today, with a note saying why,
 * and you get one email with the reply. Never throws: a failure must not stop the reply from being logged.
 */
export async function alertOutreachReply(input: { personId: string; replyClass: ReplyClass; subject: string | null; text: string | null }): Promise<void> {
  try {
    if (!NEEDS_ANSWER.includes(input.replyClass)) return
    const person = await prisma.crmPerson.findUnique({ where: { id: input.personId }, select: { fullName: true, email: true, nextFollowUpAt: true, passedAt: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { name: true } } }, take: 1 } } })
    if (!person || person.passedAt) return
    const note = `Replied to cold outreach (${LABEL[input.replyClass]}). Answer today.`
    // An earlier follow-up date is kept; otherwise it is due now.
    if (!person.nextFollowUpAt || person.nextFollowUpAt > new Date()) {
      await prisma.crmPerson.update({ where: { id: input.personId }, data: { nextFollowUpAt: new Date(), nextFollowUpNote: note } })
    }
    captureServerEvent(input.personId, 'outreach_reply_alerted', { class: input.replyClass })
    if (!process.env.RESEND_API_KEY) return
    const org = person.affiliations[0]?.org.name ?? ''
    const link = `${SITE}/support/admin/crm/people/${input.personId}`
    const excerpt = (input.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
    await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: ALERT_TO,
      subject: `Reply from ${person.fullName}${org ? ` (${org})` : ''}: ${LABEL[input.replyClass]}`,
      html: withAudienceHtml('admin', `<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#111"><p><b>${esc(person.fullName)}</b>${org ? `, ${esc(org)}` : ''} ${esc(LABEL[input.replyClass])}.</p><p style="color:#444">${esc(excerpt) || '(no text)'}</p><p><a href="${link}">Open in the CRM</a> · answer from your inbox, then log the next step.</p></div>`),
    })
  } catch (e) {
    console.error('Outreach reply alert failed', input.personId, e)
  }
}
