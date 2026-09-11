'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveSegment, type SegmentFilter } from '@/lib/crm/segments'
import { sendCrmBroadcastEmail } from '@/lib/email/send-crm-broadcast'
import type { CrmPersonRole, CrmLeadQuality, CrmWarmth, CrmSegmentKind } from '@prisma/client'

const BASE = '/support/admin/crm/segments'

export async function createSegment(formData: FormData) {
  const admin = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const kind = (String(formData.get('kind') ?? 'DYNAMIC') || 'DYNAMIC') as CrmSegmentKind

  const filter: SegmentFilter = {
    roles: formData.getAll('roles').map(String) as CrmPersonRole[],
    quality: formData.getAll('quality').map(String) as CrmLeadQuality[],
    warmth: formData.getAll('warmth').map(String) as CrmWarmth[],
    contacted: (String(formData.get('contacted') ?? '') || undefined) as 'ever' | 'never' | undefined,
    search: String(formData.get('search') ?? '').trim() || undefined,
  }

  const segment = await prisma.crmSegment.create({
    data: {
      name, kind,
      description: String(formData.get('description') ?? '').trim() || null,
      filterJson: kind === 'DYNAMIC' ? (filter as object) : undefined,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_segment_created', { segmentId: segment.id, kind })
  revalidatePath(BASE)
}

export async function deleteSegment(segmentId: string) {
  const admin = await requireAdmin()
  await prisma.crmSegment.delete({ where: { id: segmentId } })
  captureServerEvent(admin.email ?? 'admin', 'crm_segment_deleted', { segmentId })
  revalidatePath(BASE)
}

/** Removes one person from a segment's recipients, saved with the segment. */
export async function excludeFromSegment(segmentId: string, personId: string) {
  const admin = await requireAdmin()
  await prisma.crmSegmentMember.upsert({
    where: { segmentId_personId: { segmentId, personId } },
    create: { segmentId, personId, isExcluded: true },
    update: { isExcluded: true },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_segment_recipient_excluded', { segmentId, personId })
  revalidatePath(`${BASE}/${segmentId}`)
}

export async function includeInSegment(segmentId: string, personId: string) {
  await requireAdmin()
  await prisma.crmSegmentMember.updateMany({
    where: { segmentId, personId }, data: { isExcluded: false },
  })
  revalidatePath(`${BASE}/${segmentId}`)
}

/**
 * Stages a broadcast without sending it.
 *
 * Recipients are snapshotted here, not at send time, so what you confirmed is
 * exactly what goes out — a dynamic segment could otherwise change between the
 * preview and the click.
 */
export async function stageBroadcast(segmentId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!subject || !body) return

  const { recipients } = await resolveSegment(segmentId)
  const live = recipients.filter((r) => !r.excluded)

  const broadcast = await prisma.crmBroadcast.create({
    data: {
      segmentId, subject, body, recipientCount: live.length,
      recipients: {
        create: live.map((r) => ({ personId: r.id, email: r.email, status: 'staged' })),
      },
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_broadcast_staged', { broadcastId: broadcast.id, recipients: live.length })
  revalidatePath(`${BASE}/${segmentId}`)
}

/**
 * Sends a staged broadcast.
 *
 * Requires the recipient count to be typed back. That is not ceremony: this is
 * the only action in the CRM that reaches real people's inboxes, it cannot be
 * undone, and the count is the one number that catches a segment that grew
 * from 12 to 1,200 since you wrote the draft.
 */
export async function sendBroadcast(broadcastId: string, formData: FormData) {
  const admin = await requireAdmin()
  const typed = String(formData.get('confirmCount') ?? '').trim()

  const broadcast = await prisma.crmBroadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { recipients: true },
  })
  if (broadcast.sentAt) return { ok: false, message: 'That broadcast has already been sent.' }
  if (Number(typed) !== broadcast.recipientCount) {
    return { ok: false, message: `Type ${broadcast.recipientCount} to confirm. Nothing has been sent.` }
  }

  let sent = 0
  let failed = 0
  for (const r of broadcast.recipients) {
    if (r.status === 'sent') continue
    const result = await sendCrmBroadcastEmail({
      to: r.email, subject: broadcast.subject, body: broadcast.body,
      replyTo: admin.email ?? undefined,
    })
    await prisma.crmBroadcastRecipient.update({
      where: { id: r.id },
      data: {
        status: result.sent ? 'sent' : 'failed',
        error: result.sent ? null : result.error,
        sentAt: result.sent ? new Date() : null,
      },
    })
    if (result.sent) {
      sent++
      // Back-written so the person's timeline shows what they received
      // alongside one-to-one mail, which keeps last-contacted honest.
      await prisma.crmActivity.create({
        data: {
          type: 'BROADCAST_SENT', direction: 'OUTBOUND', personId: r.personId,
          subject: broadcast.subject, isAutoLogged: true,
          sourceRef: `${broadcast.id}:${r.personId}`, loggedByEmail: admin.email ?? null,
        },
      })
      await prisma.crmPerson.update({
        where: { id: r.personId },
        data: { lastTouchedAt: new Date(), touchCount: { increment: 1 } },
      })
    } else failed++
  }

  await prisma.crmBroadcast.update({
    where: { id: broadcastId },
    data: {
      sentAt: new Date(), sentByEmail: admin.email ?? null,
      error: failed > 0 ? `${failed} of ${broadcast.recipients.length} failed` : null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_broadcast_sent', { broadcastId, sent, failed })
  revalidatePath(`${BASE}`)
  return { ok: true, message: `Sent ${sent}${failed ? `, ${failed} failed` : ''}.` }
}

export async function deleteBroadcast(broadcastId: string) {
  await requireAdmin()
  const b = await prisma.crmBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, select: { sentAt: true, segmentId: true } })
  if (b.sentAt) return
  await prisma.crmBroadcast.delete({ where: { id: broadcastId } })
  revalidatePath(`${BASE}/${b.segmentId}`)
}
