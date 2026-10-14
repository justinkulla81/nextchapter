// Multi-campus systems: one license over many colleges. System users (by
// email) see a read-only dashboard across campuses; each campus runs its own
// portal. NextChapter admins create systems and assign campuses.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'

export async function systemsForEmail(email: string | null) {
  if (!email) return []
  return prisma.institutionSystem.findMany({ where: { users: { some: { email: email.toLowerCase(), revokedAt: null } } }, select: { slug: true, name: true } })
}

export async function canSeeSystem(slug: string, email: string | null, ncAdmin: boolean) {
  const s = await prisma.institutionSystem.findUnique({ where: { slug }, select: { id: true, users: { where: { email: (email ?? '').toLowerCase(), revokedAt: null }, select: { id: true } } } })
  return s && (ncAdmin || s.users.length > 0) ? s.id : null
}

const DAY = 86_400_000

// Per campus: roster, joined, participation, landed this year, in
// transition, program completions, mentor calls, events attended. Counts
// under MIN_CELL_SIZE show as null.
export async function systemDashboard(systemId: string, now = new Date()) {
  const system = await prisma.institutionSystem.findUniqueOrThrow({ where: { id: systemId }, select: { name: true, campuses: { select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } } } })
  const since = new Date(now.getTime() - 365 * DAY)
  const small = (n: number) => (n >= MIN_CELL_SIZE ? n : null)
  const campuses = await Promise.all(
    system.campuses.map(async (c) => {
      const [members, joined, landed, inTransition, completions, calls, events] = await Promise.all([
        prisma.institutionMember.count({ where: { institutionId: c.id, affiliation: { in: ['ALUM', 'STAFF_ALUM'] } } }),
        prisma.institutionMember.count({ where: { institutionId: c.id, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
        prisma.outcomeReport.count({ where: { member: { institutionId: c.id }, reportedAt: { gte: since } } }),
        prisma.transitionFlag.count({ where: { member: { institutionId: c.id }, state: 'IN_TRANSITION' } }),
        prisma.enrollment.count({ where: { cohort: { program: { institutionId: c.id } }, completedAt: { gte: since } } }),
        prisma.engagementEvent.count({ where: { institutionId: c.id, type: 'MENTOR_CALL', caseCategory: 'VOLUNTEER', occurredAt: { gte: since } } }),
        prisma.eventRsvp.count({ where: { event: { institutionId: c.id }, checkedInAt: { gte: since } } }),
      ])
      return { ...c, members, joined, participation: members ? joined / members : null, landed: small(landed), inTransition: small(inTransition), completions: small(completions), mentorCalls: small(calls), eventAttendance: small(events) }
    }),
  )
  const sum = (k: 'members' | 'joined') => campuses.reduce((n, c) => n + c[k], 0)
  return { name: system.name, campuses, totals: { members: sum('members'), joined: sum('joined'), participation: sum('members') ? sum('joined') / sum('members') : null } }
}
