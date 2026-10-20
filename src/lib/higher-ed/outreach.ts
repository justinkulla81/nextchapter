// One sender for every college email to alumni (layoff outreach, check-ins,
// gratitude, mentor notes, join invitations): a campaign row, one send per
// member, merge fields, the right link (a one-click join for someone who
// hasn't joined, the portal for someone who has), do-not-contact respected,
// and demo colleges recorded in the outbox instead of emailed. Every email
// comes from the college's own name with its reply-to, carries an
// unsubscribe link and the one-click List-Unsubscribe header, and skips
// anyone who unsubscribed, bounced or complained (emailSuppressedAt).

import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import type { OutreachCampaignType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// The college's sender settings (Admin › Overview), over sensible defaults.
export function emailSettingsFrom(enabledFeatures: unknown, inst: { name: string; programBrandName: string | null }): { fromName: string; replyTo: string | null } {
  const e = (enabledFeatures as { email?: { fromName?: string; replyTo?: string } } | null)?.email ?? {}
  return { fromName: e.fromName?.trim() || inst.programBrandName || inst.name, replyTo: e.replyTo?.trim() || null }
}

// "Display Name <addr>" is a header: no quotes, angle brackets or newlines.
const safeName = (n: string) => n.replace(/["<>\r\n]/g, '').slice(0, 80)

export function unsubscribeUrls(slug: string, claimToken: string) {
  const t = encodeURIComponent(claimToken)
  return { page: `${appUrl()}/i/${slug}/unsubscribe?t=${t}`, oneClick: `${appUrl()}/api/higher-ed/unsubscribe/${t}` }
}

export function withFooter(text: string, college: string, unsubscribe: string, workforce = false): string {
  return `${text}\n\n—\nYou're getting this ${workforce ? `because you're in ${college}'s program` : `as a ${college} alum`}. Stop these emails: ${unsubscribe}`
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
    select: { slug: true, name: true, programBrandName: true, isDemo: true, enabledFeatures: true, orgType: true },
  })
  const members = await prisma.institutionMember.findMany({
    where: { id: { in: args.recipients.map((r) => r.memberId) }, institutionId: args.institutionId },
    select: { id: true, email: true, firstName: true, doNotContact: true, emailSuppressedAt: true, candidateId: true, status: true },
  })
  const campaign = args.campaignId
    ? await prisma.outreachCampaign.update({ where: { id: args.campaignId }, data: { sentAt: new Date() }, select: { id: true } })
    : await prisma.outreachCampaign.create({
        data: { institutionId: args.institutionId, type: args.type, subject: args.subject, body: args.body, createdBy: args.createdBy, sentAt: new Date() },
        select: { id: true },
      })
  const resend = !inst.isDemo && process.env.RESEND_API_KEY ? createResend(process.env.RESEND_API_KEY, 'candidate') : null
  const brand = inst.programBrandName ?? inst.name
  const sender = emailSettingsFrom(inst.enabledFeatures, inst)
  const sendIds = new Map<string, string>()
  let sent = 0
  let skipped = 0

  for (const r of args.recipients) {
    const m = members.find((x) => x.id === r.memberId)
    if (!m || m.doNotContact || m.emailSuppressedAt || m.status === 'OPTED_OUT') {
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
      const unsub = unsubscribeUrls(inst.slug, send.claimToken)
      const result = await resend.emails.send({
        from: `${safeName(sender.fromName)} <support@launchyournextchapter.com>`,
        to: m.email,
        ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
        subject: merge(args.subject, values),
        text: withFooter(merge(args.body, values), inst.name, unsub.page, inst.orgType !== 'COLLEGE'),
        headers: { 'List-Unsubscribe': `<${unsub.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
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
