// Email health for college sends: Resend's webhook events for OutreachSend
// rows (opens, clicks, bounces, spam complaints), and unsubscribes. A hard
// bounce, a complaint or an unsubscribe suppresses the member's email for
// good: sendCampaign skips them and no roster import clears it.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { ResendEvent } from '@/lib/mailing/tracking'

export type SuppressReason = 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED'

export async function suppressMember(memberId: string, reason: SuppressReason, now = new Date()): Promise<boolean> {
  const r = await prisma.institutionMember.updateMany({
    where: { id: memberId, emailSuppressedAt: null },
    data: { emailSuppressedAt: now, emailSuppressedReason: reason },
  })
  if (r.count) captureServerEvent(`member:${memberId}`, 'he_email_suppressed', { memberId, reason })
  return r.count > 0
}

// "Changed your mind?": only an unsubscribe can be undone by the member; a
// bounce or complaint stays (the address or the inbox said no).
export async function resubscribeMember(memberId: string): Promise<boolean> {
  const r = await prisma.institutionMember.updateMany({
    where: { id: memberId, emailSuppressedReason: 'UNSUBSCRIBED' },
    data: { emailSuppressedAt: null, emailSuppressedReason: null },
  })
  if (r.count) captureServerEvent(`member:${memberId}`, 'he_email_resubscribed', { memberId })
  return r.count > 0
}

// Called before the list-mail handler; 'ignored' passes the event on.
export async function applyHigherEdEvent(event: ResendEvent): Promise<'applied' | 'ignored'> {
  const emailId = event.data?.email_id
  if (!emailId) return 'ignored'
  const send = await prisma.outreachSend.findUnique({
    where: { providerMessageId: emailId },
    select: { id: true, memberId: true, openedAt: true, clickedAt: true },
  })
  if (!send) return 'ignored'
  const at = event.created_at ? new Date(event.created_at) : new Date()
  switch (event.type) {
    case 'email.opened':
      if (!send.openedAt) await prisma.outreachSend.update({ where: { id: send.id }, data: { openedAt: at } })
      break
    case 'email.clicked':
      // The unsubscribe link is a click, not interest.
      if (event.data.click?.link?.includes('/unsubscribe')) break
      if (!send.clickedAt) await prisma.outreachSend.update({ where: { id: send.id }, data: { clickedAt: at, openedAt: send.openedAt ?? at } })
      break
    case 'email.bounced':
      // A temporary bounce is Resend still trying; only a permanent one stops mail.
      if (send.memberId && !/transient|temporary/i.test(event.data.bounce?.type ?? '')) await suppressMember(send.memberId, 'BOUNCED', at)
      break
    case 'email.complained':
      if (send.memberId) await suppressMember(send.memberId, 'COMPLAINED', at)
      break
    default:
      break
  }
  return 'applied'
}

// The member behind an email's token (test sends to staff have none).
export async function memberForToken(token: string) {
  const send = await prisma.outreachSend.findUnique({
    where: { claimToken: token },
    select: { member: { select: { id: true, firstName: true, emailSuppressedAt: true, emailSuppressedReason: true, institution: { select: { slug: true, name: true } } } } },
  })
  return send?.member ?? null
}
