// Join invitations (HE-06): one branded email per imported alum with a
// one-click join link. Sent in batches from Admin › Roster after an import.
// Demo colleges never email anyone: their sends are recorded (the demo
// outbox) and the link works for testing.

import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'

const BATCH = 100

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export function joinUrl(slug: string, claimToken: string): string {
  return `${appUrl()}/i/${slug}/join?t=${encodeURIComponent(claimToken)}`
}

// Who's due an invitation: on the roster, not joined, not do-not-contact,
// and never invited before.
export function invitableWhere(institutionId: string) {
  return {
    institutionId,
    status: { in: ['IMPORTED' as const] },
    candidateId: null,
    doNotContact: false,
    outreachSends: { none: {} },
  }
}

export async function countInvitable(institutionId: string): Promise<number> {
  return prisma.institutionMember.count({ where: invitableWhere(institutionId) })
}

export async function sendJoinInvites(args: { institutionId: string; createdBy: string }): Promise<{ sent: number; remaining: number; demo: boolean }> {
  const inst = await prisma.institution.findUniqueOrThrow({
    where: { id: args.institutionId },
    select: { slug: true, name: true, programBrandName: true, isDemo: true },
  })
  const brand = inst.programBrandName ?? inst.name
  const members = await prisma.institutionMember.findMany({
    where: invitableWhere(args.institutionId),
    take: BATCH,
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true },
  })
  if (members.length === 0) return { sent: 0, remaining: 0, demo: inst.isDemo }

  const subject = `${inst.name} has your back: your career toolkit is ready`
  const body = `Hi {{firstName}},

${inst.name} now gives every alum ${brand}: a clear read on your job market, a plan for this week, coaching, and alumni who'll take your call. It's free, and what you do in it stays yours.

Join in one click: {{joinUrl}}

${inst.name} Alumni Relations`

  const campaign = await prisma.outreachCampaign.create({
    data: { institutionId: args.institutionId, type: 'WELCOME', subject, body, createdBy: args.createdBy, sentAt: new Date() },
    select: { id: true },
  })
  const resend = !inst.isDemo && process.env.RESEND_API_KEY ? createResend(process.env.RESEND_API_KEY) : null

  let sent = 0
  for (const m of members) {
    const send = await prisma.outreachSend.create({
      data: { campaignId: campaign.id, memberId: m.id, email: m.email },
      select: { id: true, claimToken: true },
    })
    const url = joinUrl(inst.slug, send.claimToken)
    let providerMessageId: string | null = null
    if (resend) {
      const text = body.replace('{{firstName}}', m.firstName ?? 'there').replace('{{joinUrl}}', url)
      const result = await resend.emails.send({
        from: `${brand} <support@launchyournextchapter.com>`,
        to: m.email,
        subject,
        text,
      })
      if (result.error) {
        // Not sent: drop the row so the next batch retries this alum.
        await prisma.outreachSend.delete({ where: { id: send.id } })
        continue
      }
      providerMessageId = result.data?.id ?? null
    }
    await prisma.outreachSend.update({ where: { id: send.id }, data: { sentAt: new Date(), providerMessageId } })
    await prisma.institutionMember.update({ where: { id: m.id }, data: { status: 'INVITED' } })
    sent++
  }
  return { sent, remaining: await countInvitable(args.institutionId), demo: inst.isDemo }
}
