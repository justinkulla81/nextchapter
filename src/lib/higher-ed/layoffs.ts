// Layoff alerts (spec §6.2, HE-08): WARN notices matched to alumni employers.
// A notice matches a member when its company is the member's current
// employer in NextChapter, or its normalized employer name equals the
// roster's last-known employer. Only MATCHED notices (or exact name matches)
// count; ambiguous ones stay on the WARN review page. A match never flags
// anyone: the member says whether they were affected. A NextChapter employer
// counts only for members who share their outcome with the college; the
// roster employer is the college's own data.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendCampaign } from './outreach'

const WINDOW_DAYS = 180

export async function matchLayoffs(institutionId: string, now = new Date()): Promise<{ added: number }> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000)
  const notices = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] },
    select: { id: true, companyId: true, companyMatchStatus: true, normalizedEmployer: true },
  })
  if (!notices.length) return { added: 0 }
  const matched = notices.filter((n) => n.companyMatchStatus === 'MATCHED' && n.companyId)
  const byCompany = new Map<string, string[]>()
  for (const n of matched) byCompany.set(n.companyId!, [...(byCompany.get(n.companyId!) ?? []), n.id])
  const byName = new Map<string, { id: string; companyId: string | null }[]>()
  for (const n of notices) byName.set(n.normalizedEmployer, [...(byName.get(n.normalizedEmployer) ?? []), { id: n.id, companyId: n.companyId }])

  const members = await prisma.institutionMember.findMany({
    where: {
      institutionId,
      status: { not: 'OPTED_OUT' },
      OR: [
        { lastKnownEmployerNormalized: { in: [...byName.keys()] } },
        { candidate: { memberEmployment: { some: { isCurrent: true, companyId: { in: [...byCompany.keys()] } } } } },
      ],
    },
    select: {
      id: true,
      lastKnownEmployerNormalized: true,
      candidate: { select: { memberEmployment: { where: { isCurrent: true }, select: { companyId: true } } } },
    },
  })

  const sharing = new Set(
    members.length
      ? (
          await prisma.$queryRaw<{ memberId: string }[]>`
            select "memberId" from private.v_member_consent where "institutionId" = ${institutionId} and "shareOutcome"`
        ).map((r) => r.memberId)
      : [],
  )
  const rows: { institutionId: string; warnNoticeId: string; memberId: string; companyId: string | null }[] = []
  for (const m of members) {
    for (const e of sharing.has(m.id) ? (m.candidate?.memberEmployment ?? []) : []) {
      for (const nid of byCompany.get(e.companyId) ?? []) rows.push({ institutionId, warnNoticeId: nid, memberId: m.id, companyId: e.companyId })
    }
    for (const n of (m.lastKnownEmployerNormalized && byName.get(m.lastKnownEmployerNormalized)) || []) {
      rows.push({ institutionId, warnNoticeId: n.id, memberId: m.id, companyId: n.companyId })
    }
  }
  if (!rows.length) return { added: 0 }
  const r = await prisma.layoffMatch.createMany({ data: rows, skipDuplicates: true })
  return { added: r.count }
}

export const LAYOFF_SUBJECT = '{{college}} has your back'
export const LAYOFF_BODY = `Hi {{firstName}},

We saw the news about layoffs at {{employer}}. If you're affected, {{college}} has your back: a clear read on your job market, a plan for this week, coaching, and alumni who'll take your call. It's free for {{college}} alumni.

If you're not affected, there's nothing you need to do. We're here if that changes.

Start here: {{link}}

{{college}} Alumni Relations`

// Alumni Relations clicks "Send outreach": the LAYOFF email to the chosen
// matches (or every new one), each marked SENT with its send.
export async function sendLayoffOutreach(args: { institutionId: string; matchIds?: string[]; createdBy: string }) {
  const matches = await prisma.layoffMatch.findMany({
    where: { institutionId: args.institutionId, outreachStatus: 'NEW', ...(args.matchIds ? { id: { in: args.matchIds } } : {}) },
    select: { id: true, memberId: true, warnNotice: { select: { employer: true } } },
  })
  if (!matches.length) return { sent: 0, skipped: 0, demo: false }
  const result = await sendCampaign({
    institutionId: args.institutionId,
    type: 'LAYOFF',
    subject: LAYOFF_SUBJECT,
    body: LAYOFF_BODY,
    createdBy: args.createdBy,
    recipients: [...new Map(matches.map((m) => [m.memberId, { memberId: m.memberId, extra: { employer: m.warnNotice.employer } }])).values()],
  })
  // One email per member even when they match several notices; the send is
  // linked to the first match (outreachSendId is unique), the rest are SENT.
  const linked = new Set<string>()
  for (const m of matches) {
    const sendId = result.sendIds.get(m.memberId)
    const link = sendId && !linked.has(sendId)
    if (link) linked.add(sendId)
    await prisma.layoffMatch.update({
      where: { id: m.id },
      data: sendId ? { outreachStatus: 'SENT', ...(link ? { outreachSendId: sendId } : {}) } : { outreachStatus: 'SKIPPED' },
    })
  }
  return { sent: result.sent, skipped: result.skipped, demo: result.demo }
}
