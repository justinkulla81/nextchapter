// Caseloads (spec §5.4, HE-11): who each counselor or college coach is
// responsible for. Assigned by hand from Career Services, or automatically
// when an alum tells a check-in they're looking or laid off: they go to the
// counselor with the fewest open cases, so "alerts the counselor" means a
// person, not a queue. One open assignment per member.

import 'server-only'
import { prisma } from '@/lib/prisma'

export const CASELOAD_ROLES = ['CAREER_SERVICES', 'COACH'] as const

export async function counselors(institutionId: string) {
  const rows = await prisma.institutionUser.findMany({
    where: { institutionId, role: { in: [...CASELOAD_ROLES] }, revokedAt: null },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, invitedEmail: true, role: true, _count: { select: { caseloadAssignments: { where: { endedAt: null } } } } },
  })
  return rows.map((r) => ({ id: r.id, name: r.fullName ?? r.invitedEmail, role: r.role, open: r._count.caseloadAssignments }))
}

export async function openAssignment(memberId: string) {
  return prisma.caseloadAssignment.findFirst({
    where: { memberId, endedAt: null },
    select: { id: true, counselorId: true, counselor: { select: { fullName: true, invitedEmail: true } } },
  })
}

// Moves the member if they're already on someone else's caseload.
export async function assignToCaseload(args: { institutionId: string; memberId: string; counselorId: string }) {
  const [member, counselor] = await Promise.all([
    prisma.institutionMember.findFirst({ where: { id: args.memberId, institutionId: args.institutionId }, select: { id: true } }),
    prisma.institutionUser.findFirst({ where: { id: args.counselorId, institutionId: args.institutionId, role: { in: [...CASELOAD_ROLES] }, revokedAt: null }, select: { id: true } }),
  ])
  if (!member) return { error: 'That person isn’t on your roster.' }
  if (!counselor) return { error: 'Pick a counselor or coach at your college.' }
  const open = await openAssignment(args.memberId)
  if (open?.counselorId === args.counselorId) return { id: open.id, changed: false }
  const now = new Date()
  if (open) await prisma.caseloadAssignment.update({ where: { id: open.id }, data: { endedAt: now } })
  const a = await prisma.caseloadAssignment.create({
    data: { institutionId: args.institutionId, counselorId: args.counselorId, memberId: args.memberId, assignedAt: now },
    select: { id: true },
  })
  return { id: a.id, changed: true }
}

export async function endAssignment(institutionId: string, assignmentId: string) {
  const r = await prisma.caseloadAssignment.updateMany({ where: { id: assignmentId, institutionId, endedAt: null }, data: { endedAt: new Date() } })
  return r.count > 0
}

// Check-in "looking" or "laid off": already on a caseload stays put;
// otherwise the counselor with the fewest open cases (counselors before
// coaches). Null when the college has no one to assign to.
export async function autoAssign(institutionId: string, memberId: string): Promise<string | null> {
  const open = await openAssignment(memberId)
  if (open) return open.counselorId
  const pool = (await counselors(institutionId)).sort((a, b) => Number(a.role !== 'CAREER_SERVICES') - Number(b.role !== 'CAREER_SERVICES') || a.open - b.open)
  if (!pool.length) return null
  await assignToCaseload({ institutionId, memberId, counselorId: pool[0].id })
  return pool[0].id
}

// "Add someone": roster search by name or email, for Career Services.
export async function searchRoster(institutionId: string, q: string) {
  const term = q.trim()
  if (term.length < 2) return []
  const parts = term.split(/\s+/)
  return prisma.institutionMember.findMany({
    where: {
      institutionId,
      status: { not: 'OPTED_OUT' },
      AND: parts.map((p) => ({ OR: [{ firstName: { contains: p, mode: 'insensitive' as const } }, { lastName: { contains: p, mode: 'insensitive' as const } }, { email: { contains: p, mode: 'insensitive' as const } }] })),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 10,
    select: { id: true, firstName: true, lastName: true, classYear: true, caseloadAssignments: { where: { endedAt: null }, select: { counselor: { select: { fullName: true } } } } },
  })
}
