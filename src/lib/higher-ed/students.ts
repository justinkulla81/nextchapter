// Career Services › Student tools (spec §5.4, HE-11): invite students and
// recent grads (graduated in the last five years) who are on the roster but
// haven't been invited, with a first-job message instead of the alumni one.
// Students arrive through the roster CSV with affiliation STUDENT.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { invitableWhere } from './invites'
import { sendCampaign } from './outreach'

const BATCH = 100

function earlyCareerWhere(institutionId: string, now: Date) {
  return {
    ...invitableWhere(institutionId),
    OR: [{ affiliation: 'STUDENT' as const }, { affiliation: 'ALUM' as const, classYear: { gte: now.getUTCFullYear() - 5 } }],
  }
}

export async function studentCounts(institutionId: string, now = new Date()) {
  const recent = { affiliation: 'ALUM' as const, classYear: { gte: now.getUTCFullYear() - 5 } }
  const [students, recentGrads, joined, invitable] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId, affiliation: 'STUDENT' } }),
    prisma.institutionMember.count({ where: { institutionId, ...recent } }),
    prisma.institutionMember.count({ where: { institutionId, status: { in: ['CLAIMED', 'ACTIVE'] }, OR: [{ affiliation: 'STUDENT' }, recent] } }),
    prisma.institutionMember.count({ where: earlyCareerWhere(institutionId, now) }),
  ])
  return { students, recentGrads, joined, invitable }
}

export const STUDENT_SUBJECT = 'Your first job, with {{college}} behind you'
export const STUDENT_BODY = `Hi {{firstName}},

{{college}} Career Services gives you {{brand}}, free: a clear read on the job market for what you studied, a plan for this week, interview practice, and alumni who'll take your call.

It's yours through your first years after graduation, and what you do in it stays yours.

Join in one click: {{link}}

{{college}} Career Services`

export async function sendStudentInvites(args: { institutionId: string; createdBy: string; now?: Date }) {
  const members = await prisma.institutionMember.findMany({
    where: earlyCareerWhere(args.institutionId, args.now ?? new Date()),
    take: BATCH,
    orderBy: [{ classYear: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  if (!members.length) return { sent: 0, skipped: 0, demo: false }
  return sendCampaign({
    institutionId: args.institutionId,
    type: 'WELCOME',
    subject: STUDENT_SUBJECT,
    body: STUDENT_BODY,
    createdBy: args.createdBy,
    recipients: members.map((m) => ({ memberId: m.id })),
  })
}
