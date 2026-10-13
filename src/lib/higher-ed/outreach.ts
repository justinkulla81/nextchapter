// One sender for every college email to alumni (layoff outreach, check-ins,
// gratitude, mentor notes, join invitations): a campaign row, one send per
// member, merge fields, the right link (a one-click join for someone who
// hasn't joined, the portal for someone who has), do-not-contact respected,
// and demo colleges recorded in the outbox instead of emailed.

import 'server-only'
import { Resend } from 'resend'
import type { OutreachCampaignType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export type Recipient = { memberId: string; extra?: Record<string, string> }

// {{firstName}}, {{college}}, {{link}} and any extra keys per recipient.
export function merge(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
}

export async function sendCampaign(args: {
  institutionId: string
  type: OutreachCampaignType
  subject: string
  body: string
  createdBy: string
  recipients: Recipient[]
  // Where {{link}} points; defaults to join (not joined) or the portal (joined).
  linkFor?: (m: { id: string; joined: boolean }, claimToken: string) => string
  // Send into an existing campaign (a composer draft) instead of a new one.
  campaignId?: string
}): Promise<{ campaignId: string; sent: number; skipped: number; sendIds: Map<string, string>; demo: boolean }> {
  const inst = await prisma.institution.findUniqueOrThrow({
    where: { id: args.institutionId },
    select: { slug: true, name: true, programBrandName: true, isDemo: true },
  })
  const members = await prisma.institutionMember.findMany({
    where: { id: { in: args.recipients.map((r) => r.memberId) }, institutionId: args.institutionId },
    select: { id: true, email: true, firstName: true, doNotContact: true, candidateId: true, status: true },
  })
  const campaign = args.campaignId
    ? await prisma.outreachCampaign.update({ where: { id: args.campaignId }, data: { sentAt: new Date() }, select: { id: true } })
    : await prisma.outreachCampaign.create({
        data: { institutionId: args.institutionId, type: args.type, subject: args.subject, body: args.body, createdBy: args.createdBy, sentAt: new Date() },
        select: { id: true },
      })
  const resend = !inst.isDemo && process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const brand = inst.programBrandName ?? inst.name
  const sendIds = new Map<string, string>()
  let sent = 0
  let skipped = 0

  for (const r of args.recipients) {
    const m = members.find((x) => x.id === r.memberId)
    if (!m || m.doNotContact || m.status === 'OPTED_OUT') {
      skipped++
      continue
    }
    const send = await prisma.outreachSend.create({ data: { campaignId: campaign.id, memberId: m.id, email: m.email }, select: { id: true, claimToken: true } })
    const joined = !!m.candidateId && (m.status === 'CLAIMED' || m.status === 'ACTIVE')
    const link = args.linkFor
      ? args.linkFor({ id: m.id, joined }, send.claimToken)
      : joined
        ? `${appUrl()}/i/${inst.slug}/candidate`
        : `${appUrl()}/i/${inst.slug}/join?t=${encodeURIComponent(send.claimToken)}`
    const values = { firstName: m.firstName ?? 'there', college: inst.name, brand, link, ...(r.extra ?? {}) }
    let providerMessageId: string | null = null
    if (resend) {
      const result = await resend.emails.send({
        from: `${brand} <support@launchyournextchapter.com>`,
        to: m.email,
        subject: merge(args.subject, values),
        text: merge(args.body, values),
      })
      if (result.error) {
        await prisma.outreachSend.delete({ where: { id: send.id } })
        skipped++
        continue
      }
      providerMessageId = result.data?.id ?? null
    }
    await prisma.outreachSend.update({ where: { id: send.id }, data: { sentAt: new Date(), providerMessageId } })
    sendIds.set(m.id, send.id)
    sent++
  }
  return { campaignId: campaign.id, sent, skipped, sendIds, demo: inst.isDemo }
}
