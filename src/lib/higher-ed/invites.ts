// Join invitations (HE-06): one branded email per imported alum with a
// one-click join link. Sent in batches from Admin › Roster after an import.
// Demo colleges never email anyone: their sends are recorded (the demo
// outbox) and the link works for testing.

import 'server-only'
import { sendCampaign } from './outreach'
import { prisma } from '@/lib/prisma'
import { inviteCapMessage, institutionEntitlements } from '@/lib/plans/entitlements'
import { engagedMemberCount, recordCapReached } from '@/lib/plans/member-cap'

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
    emailSuppressedAt: null,
    // Program learners who aren't alumni never get the alumni invitation.
    affiliation: { not: 'LEARNER' as const },
    outreachSends: { none: {} },
  }
}

export async function countInvitable(institutionId: string): Promise<number> {
  return prisma.institutionMember.count({ where: invitableWhere(institutionId) })
}

export async function sendJoinInvites(args: { institutionId: string; createdBy: string }): Promise<{ sent: number; remaining: number; demo: boolean; capReached?: { cap: number; left: number; message: string } }> {
  const inst = await prisma.institution.findUniqueOrThrow({
    where: { id: args.institutionId },
    select: { slug: true, name: true, programBrandName: true, isDemo: true, orgType: true, plan: true },
  })
  // The free plan: invitations stop at the member cap (people already invited
  // or joined count; see src/lib/plans/member-cap.ts).
  const cap = institutionEntitlements({ plan: inst.plan }).memberCap
  let room = BATCH
  let left = Infinity
  if (cap !== null) {
    left = Math.max(0, cap - (await engagedMemberCount(args.institutionId)))
    if (left === 0) {
      recordCapReached(args.createdBy, inst.slug, cap, 'invite')
      return { sent: 0, remaining: await countInvitable(args.institutionId), demo: inst.isDemo, capReached: { cap, left, message: inviteCapMessage(cap, 0) } }
    }
    room = Math.min(BATCH, left)
  }
  const brand = inst.programBrandName ?? inst.name
  const members = await prisma.institutionMember.findMany({
    where: invitableWhere(args.institutionId),
    take: room,
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true },
  })
  if (members.length === 0) return { sent: 0, remaining: 0, demo: inst.isDemo }

  const workforce = inst.orgType !== 'COLLEGE'
  const subject = workforce ? `${inst.name} is covering your job search support` : `${inst.name} has your back: your career toolkit is ready`
  const body = workforce
    ? `Hi {{firstName}},

${inst.name} is giving you ${brand}, free: a clear read on your job market, a plan for each week, coaching, and local employers who are hiring. What you do in it stays yours.

Start in one click: {{link}}

${inst.name}`
    : `Hi {{firstName}},

${inst.name} now gives every alum ${brand}: a clear read on your job market, a plan for this week, coaching, and alumni who'll take your call. It's free, and what you do in it stays yours.

Join in one click: {{link}}

${inst.name} Alumni Relations`

  // The shared sender: college name and reply-to, unsubscribe link and
  // header, suppressed addresses skipped. Its default {{link}} is the join link.
  const r = await sendCampaign({
    institutionId: args.institutionId,
    type: 'WELCOME',
    subject,
    body,
    createdBy: args.createdBy,
    recipients: members.map((m) => ({ memberId: m.id })),
  })
  const invited = [...r.sendIds.keys()]
  if (invited.length) await prisma.institutionMember.updateMany({ where: { id: { in: invited }, status: 'IMPORTED' }, data: { status: 'INVITED' } })
  const sent = r.sent
  const remaining = await countInvitable(args.institutionId)
  const leftNow = Math.max(0, left - sent)
  if (cap !== null && remaining > 0 && leftNow === 0) {
    recordCapReached(args.createdBy, inst.slug, cap, 'invite')
    return { sent, remaining, demo: inst.isDemo, capReached: { cap, left: 0, message: inviteCapMessage(cap, remaining) } }
  }
  return { sent, remaining, demo: inst.isDemo }
}
