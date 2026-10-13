// Join invitations (HE-06): one branded email per imported alum with a
// one-click join link. Sent in batches from Admin › Roster after an import.
// Demo colleges never email anyone: their sends are recorded (the demo
// outbox) and the link works for testing.

import 'server-only'
import { sendCampaign } from './outreach'
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
    emailSuppressedAt: null,
    // Program learners who aren't alumni never get the alumni invitation.
    affiliation: { not: 'LEARNER' as const },
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
  return { sent, remaining: await countInvitable(args.institutionId), demo: inst.isDemo }
}
