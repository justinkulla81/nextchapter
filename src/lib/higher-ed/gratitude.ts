// The gratitude ask (spec §6.5): after an alum's grace period ends, and only
// when they said the college helped, Development approves a thank-you with
// a link to give. Clicks are tracked through /i/[slug]/give, so a gift that
// shows up in the next import can be traced to the ask.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendCampaign } from './outreach'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export const GRATITUDE_SUBJECT = 'Congratulations, {{firstName}}'
export const GRATITUDE_BODY = `Hi {{firstName}},

Congratulations on the new role. You told us {{college}} helped along the way, and that means a lot to everyone here.

If you'd like to pay it forward, a gift to {{fund}} helps the next alum through a hard stretch: coaching, a plan, and someone in their corner.

Give here: {{link}}

Thank you,
{{college}}`

export async function sendGratitude(args: { institutionId: string; outcomeReportIds: string[]; createdBy: string }) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true, givingUrl: true } })
  if (!inst.givingUrl) return { error: 'Add your giving page in Admin › Overview first.' as const }
  const fund = await prisma.resilienceFund.findFirst({ where: { institutionId: args.institutionId, isActive: true }, select: { name: true } })
  const reports = await prisma.outcomeReport.findMany({
    where: { id: { in: args.outcomeReportIds }, gratitudeStatus: 'PENDING', member: { institutionId: args.institutionId } },
    select: { id: true, memberId: true, member: { select: { transitionFlags: { where: { openFlagMemberId: { not: null }, doNotSolicit: true }, select: { id: true } } } } },
  })
  // Never ask someone with an open do-not-solicit flag (laid off again since).
  const ok = reports.filter((r) => r.member.transitionFlags.length === 0)
  if (!ok.length) return { sent: 0, skipped: reports.length, demo: false }
  const result = await sendCampaign({
    institutionId: args.institutionId,
    type: 'GRATITUDE',
    subject: GRATITUDE_SUBJECT,
    body: GRATITUDE_BODY,
    createdBy: args.createdBy,
    recipients: [...new Map(ok.map((r) => [r.memberId, { memberId: r.memberId, extra: { fund: fund?.name ?? 'the Annual Fund' } }])).values()],
    linkFor: (_m, token) => `${appUrl()}/i/${inst.slug}/give?t=${encodeURIComponent(token)}`,
  })
  const sentIds = ok.filter((r) => result.sendIds.has(r.memberId)).map((r) => r.id)
  if (sentIds.length) await prisma.outcomeReport.updateMany({ where: { id: { in: sentIds } }, data: { gratitudeStatus: 'SENT' } })
  return { sent: result.sent, skipped: result.skipped + (reports.length - ok.length), demo: result.demo }
}

// A click on a giving link: the send (if any) is marked clicked, the ask
// moves to CLICKED, and the click scores as GIFT_PROMPT_CLICK for members
// who share engagement. Returns where to send them.
export async function recordGiveClick(args: { slug: string; token?: string | null; memberId?: string | null; now?: Date }): Promise<string | null> {
  const now = args.now ?? new Date()
  const inst = await prisma.institution.findUnique({ where: { slug: args.slug }, select: { id: true, givingUrl: true } })
  if (!inst?.givingUrl) return null
  let memberId = args.memberId ?? null
  if (args.token) {
    const send = await prisma.outreachSend.findUnique({ where: { claimToken: args.token }, select: { id: true, memberId: true, clickedAt: true, member: { select: { institutionId: true } } } })
    if (send?.member?.institutionId === inst.id) {
      memberId = send.memberId
      if (!send.clickedAt) await prisma.outreachSend.update({ where: { id: send.id }, data: { clickedAt: now } })
    }
  }
  if (memberId) {
    await prisma.outcomeReport.updateMany({ where: { memberId, gratitudeStatus: 'SENT' }, data: { gratitudeStatus: 'CLICKED' } })
    const [consent] = await prisma.$queryRaw<{ shareEngagement: boolean }[]>`
      select "shareEngagement" from private.v_member_consent where "memberId" = ${memberId}`
    if (consent?.shareEngagement) {
      const day = now.toISOString().slice(0, 10)
      await prisma.engagementEvent.createMany({
        data: [{ institutionId: inst.id, memberId, type: 'GIFT_PROMPT_CLICK', caseCategory: 'PHILANTHROPIC', points: 1, occurredAt: now, sourceTable: 'GiveClick', sourceId: `${memberId}:${day}` }],
        skipDuplicates: true,
      })
    }
  }
  return inst.givingUrl
}
