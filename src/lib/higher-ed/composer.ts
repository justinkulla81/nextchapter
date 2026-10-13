// Outreach composer (spec §5.2, Alumni Relations › Outreach): write an email
// with merge fields, preview it, send a test to yourself, then send in
// batches of 200 to an audience. A draft is an OutreachCampaign (type
// CUSTOM) with no sentAt; once anything is sent it can't be edited, and each
// batch goes to people this campaign hasn't reached yet.

import 'server-only'
import type { Prisma } from '@prisma/client'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import { emailSettingsFrom, merge, sendCampaign, withFooter } from './outreach'

export const BATCH = 200

export const AUDIENCES = [
  { key: 'all', label: 'All alumni' },
  { key: 'joined', label: 'Joined' },
  { key: 'not_joined', label: 'Not joined yet' },
  { key: 'recent_grads', label: 'Recent grads' },
] as const
export type Audience = (typeof AUDIENCES)[number]['key']
export const isAudience = (a: unknown): a is Audience => AUDIENCES.some((x) => x.key === a)

export const MERGE_FIELDS = [
  { key: 'firstName', label: 'First name', example: 'Jordan' },
  { key: 'college', label: 'College', example: '' },
  { key: 'link', label: 'Their link (join, or their page if joined)', example: '' },
] as const

// Unknown or misspelled fields would send as blanks; catch them first.
export function unknownFields(text: string): string[] {
  const known = new Set<string>(MERGE_FIELDS.map((f) => f.key))
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !known.has(k)))]
}

export function audienceWhere(institutionId: string, audience: Audience, now = new Date()): Prisma.InstitutionMemberWhereInput {
  const base: Prisma.InstitutionMemberWhereInput = { institutionId, affiliation: { in: ['ALUM', 'STAFF_ALUM'] }, status: { not: 'OPTED_OUT' }, doNotContact: false, emailSuppressedAt: null }
  if (audience === 'joined') return { ...base, status: { in: ['CLAIMED', 'ACTIVE'] } }
  if (audience === 'not_joined') return { ...base, status: { in: ['IMPORTED', 'INVITED'] } }
  if (audience === 'recent_grads') return { ...base, classYear: { gte: now.getUTCFullYear() - 5 } }
  return base
}

export async function audienceCount(institutionId: string, audience: Audience) {
  return prisma.institutionMember.count({ where: audienceWhere(institutionId, audience) })
}

export async function saveDraft(args: { institutionId: string; id?: string | null; subject: string; body: string; audience: Audience; createdBy: string }) {
  if (args.id) {
    const r = await prisma.outreachCampaign.updateMany({
      where: { id: args.id, institutionId: args.institutionId, type: 'CUSTOM', sentAt: null },
      data: { subject: args.subject, body: args.body, audience: args.audience },
    })
    if (!r.count) return { error: 'This email has been sent, so it can’t be edited. Start a new one.' }
    return { id: args.id }
  }
  const c = await prisma.outreachCampaign.create({
    data: { institutionId: args.institutionId, type: 'CUSTOM', subject: args.subject, body: args.body, audience: args.audience, createdBy: args.createdBy },
    select: { id: true },
  })
  return { id: c.id }
}

export async function listComposed(institutionId: string) {
  const rows = await prisma.outreachCampaign.findMany({
    where: { institutionId, type: 'CUSTOM', audience: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, subject: true, body: true, audience: true, sentAt: true, createdAt: true, _count: { select: { sends: { where: { memberId: { not: null } } } } } },
  })
  return Promise.all(
    rows.map(async (r) => {
      const audience = isAudience(r.audience) ? r.audience : 'all'
      const remaining = await prisma.institutionMember.count({ where: { ...audienceWhere(institutionId, audience), outreachSends: { none: { campaignId: r.id } } } })
      return { ...r, audience, sent: r._count.sends, remaining }
    }),
  )
}

// The next batch of the audience this campaign hasn't reached.
export async function sendNextBatch(args: { institutionId: string; campaignId: string; createdBy: string }) {
  const c = await prisma.outreachCampaign.findFirst({
    where: { id: args.campaignId, institutionId: args.institutionId, type: 'CUSTOM' },
    select: { id: true, subject: true, body: true, audience: true },
  })
  if (!c || !isAudience(c.audience)) return { error: 'That email is gone. Reload the page.' }
  const bad = unknownFields(`${c.subject} ${c.body}`)
  if (bad.length) return { error: `Fix the merge fields first: ${bad.map((b) => `{{${b}}}`).join(', ')}.` }
  const members = await prisma.institutionMember.findMany({
    where: { ...audienceWhere(args.institutionId, c.audience), outreachSends: { none: { campaignId: c.id } } },
    orderBy: { id: 'asc' },
    take: BATCH,
    select: { id: true },
  })
  if (!members.length) return { sent: 0, skipped: 0, demo: false }
  return sendCampaign({
    institutionId: args.institutionId,
    type: 'CUSTOM',
    subject: c.subject,
    body: c.body,
    createdBy: args.createdBy,
    recipients: members.map((m) => ({ memberId: m.id })),
    campaignId: c.id,
  })
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// What one recipient would see, with sample values.
export function previewValues(college: string, slug: string) {
  return { firstName: 'Jordan', college, brand: college, link: `${appUrl()}/i/${slug}/join?t=example` }
}

// "Send a test to me": the email as written, to the staff member's own
// address, logged as a send with no member. Demo colleges show it instead.
export async function sendTestToSelf(args: { institutionId: string; campaignId: string; to: string }) {
  const [c, inst] = await Promise.all([
    prisma.outreachCampaign.findFirst({ where: { id: args.campaignId, institutionId: args.institutionId }, select: { id: true, subject: true, body: true } }),
    prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true, name: true, programBrandName: true, isDemo: true, enabledFeatures: true } }),
  ])
  if (!c) return { error: 'That email is gone. Reload the page.' }
  const values = previewValues(inst.name, inst.slug)
  const subject = `[Test] ${merge(c.subject, values)}`
  const text = withFooter(merge(c.body, values), inst.name, `${appUrl()}/i/${inst.slug}/unsubscribe?t=example`)
  if (inst.isDemo || !process.env.RESEND_API_KEY) return { demo: true, subject, text }
  const sender = emailSettingsFrom(inst.enabledFeatures, inst)
  const r = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: `${sender.fromName.replace(/["<>\r\n]/g, '')} <support@launchyournextchapter.com>`,
    to: args.to,
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    subject,
    text,
  })
  if (r.error) return { error: 'The test didn’t send. Try again in a minute.' }
  await prisma.outreachSend.create({ data: { campaignId: c.id, memberId: null, email: args.to, sentAt: new Date(), providerMessageId: r.data?.id ?? null } })
  return { demo: false, subject, text }
}
