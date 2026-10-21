import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { suppress } from '@/lib/mailing/lists'
import type { ResendEvent } from '@/lib/mailing/tracking'
import { bareAddress, isAutomatedClick, isOutreachEvent, isPermanentBounce, withHumanOpen } from './event-rules'

/**
 * Cold outreach sent with the Resend tag `outreach` reports back here. A permanent bounce marks the
 * address invalid and stops all mail to it; a spam complaint also marks the person passed. Both go on
 * the shared suppression list that the mail-merge builder reads. Opens are deliberately not recorded:
 * a pixel is unreliable and hurts deliverability, and replies and clicks are the signals that matter.
 * Events for email without the tag are ignored.
 */
export async function applyOutreachEvent(event: ResendEvent): Promise<'applied' | 'ignored'> {
  if (!isOutreachEvent(event)) return 'ignored'
  const to = bareAddress(event.data.to?.[0])
  if (!to) return 'ignored'

  if (event.type === 'email.opened' || event.type === 'email.clicked') {
    // Directional only: opens are inflated by mail privacy features, so compare variants against each other, never to a benchmark.
    const send = event.data.email_id ? await prisma.crmActivity.findFirst({ where: { sourceRef: `resend:${event.data.email_id}` }, select: { id: true, outcome: true, personId: true, occurredAt: true } }) : null
    // A click within two minutes of the send is almost always a mail scanner following the link, not a person.
    const seconds = send ? ((event.created_at ? Date.parse(event.created_at) : Date.now()) - send.occurredAt.getTime()) / 1000 : 0
    const mark = event.type === 'email.opened' ? ', opened' : isAutomatedClick(seconds) ? ', clicked_auto' : ', clicked'
    // Every open after the first two minutes is counted, because a second or third open is a sign of interest (the first, instant one is usually a scanner).
    if (send && event.type === 'email.opened' && !isAutomatedClick(seconds)) {
      await prisma.crmActivity.update({ where: { id: send.id }, data: { outcome: withHumanOpen(send.outcome) } })
      captureServerEvent(send.personId ?? 'outreach', 'outreach_email_reopened', {})
      return 'applied'
    }
    if (!send || (send.outcome ?? '').includes(`${mark},`) || (send.outcome ?? '').endsWith(mark)) return 'ignored'
    await prisma.crmActivity.update({ where: { id: send.id }, data: { outcome: `${send.outcome ?? ''}${mark}` } })
    captureServerEvent(send.personId ?? 'outreach', event.type === 'email.opened' ? 'outreach_email_opened' : mark === ', clicked' ? 'outreach_email_clicked' : 'outreach_email_clicked_auto', {})
    return 'applied'
  }

  const person = await prisma.crmPerson.findFirst({
    where: { deletedAt: null, OR: [{ email: { equals: to, mode: 'insensitive' } }, { emails: { has: to } }] },
    select: { id: true },
  })

  if (event.type === 'email.bounced') {
    // Any bounce is noted on the send and stops outreach to the address.
    const sent = event.data.email_id ? await prisma.crmActivity.findFirst({ where: { sourceRef: `resend:${event.data.email_id}` }, select: { id: true, outcome: true } }) : null
    if (sent && !(sent.outcome ?? '').includes(', bounced')) await prisma.crmActivity.update({ where: { id: sent.id }, data: { outcome: `${sent.outcome ?? ''}, bounced` } })
    const detail = [event.data.bounce?.type, event.data.bounce?.subType, event.data.bounce?.message].filter(Boolean).join(' · ')
    // Resend reports a bounce only after it has given up, and a corporate mail server that refuses us once will refuse again: any bounce stops cold outreach to the address.
    // A hard bounce also marks the address invalid; a soft one is only suppressed, so it can be reviewed.
    await suppress(to, 'BOUNCED', detail)
    if (person && isPermanentBounce(event)) await prisma.crmPerson.update({ where: { id: person.id }, data: { emailVerifiedStatus: 'invalid', emailVerifiedAt: new Date() } })
    captureServerEvent(person?.id ?? 'outreach', 'outreach_email_bounced', { permanent: isPermanentBounce(event) })
    return 'applied'
  }
  if (event.type === 'email.complained') {
    await suppress(to, 'COMPLAINED', 'Marked as spam')
    if (person) await prisma.crmPerson.update({ where: { id: person.id }, data: { passedAt: new Date() } })
    captureServerEvent(person?.id ?? 'outreach', 'outreach_email_complained', {})
    return 'applied'
  }
  return 'ignored'
}
