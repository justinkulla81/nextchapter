import 'server-only'
import { prisma } from '@/lib/prisma'
import { displayName, matchesFilter } from './mentor-rules'

function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export type MentorCard = {
  mentorId: string
  name: string // first name and last initial only
  classYear: number | null
  industries: string[]
  functions: string[]
  full: boolean // no room this month
  myOpenRequest: boolean // the viewer already has an open request with this mentor
}

// Mentors a member can browse: active, same institution, opted in, not me.
export async function listMentorCards(opts: { institutionId: string; viewerMemberId: string; industry: string; fn: string }): Promise<MentorCard[]> {
  const since = startOfMonthUtc()
  const mentors = await prisma.institutionMentor.findMany({
    where: { institutionId: opts.institutionId, isActive: true, memberId: { not: opts.viewerMemberId } },
    select: {
      id: true,
      industries: true,
      functions: true,
      maxCallsPerMonth: true,
      member: { select: { firstName: true, lastName: true, classYear: true } },
      requests: { select: { requesterMemberId: true, status: true, requestedAt: true } },
    },
  })
  return mentors
    .filter((m) => matchesFilter(m, opts.industry, opts.fn))
    .map((m) => {
      const open = m.requests.filter((r) => (r.status === 'REQUESTED' || r.status === 'ACCEPTED') && r.requestedAt >= since)
      return {
        mentorId: m.id,
        name: displayName(m.member.firstName, m.member.lastName),
        classYear: m.member.classYear,
        industries: m.industries,
        functions: m.functions,
        full: open.length >= m.maxCallsPerMonth,
        myOpenRequest: m.requests.some((r) => r.requesterMemberId === opts.viewerMemberId && (r.status === 'REQUESTED' || r.status === 'ACCEPTED')),
      }
    })
}

export async function getMyMentorProfile(memberId: string) {
  return prisma.institutionMentor.findUnique({ where: { memberId } })
}

export async function listRequestsForMentor(mentorId: string) {
  return prisma.mentorRequest.findMany({
    where: { mentorId },
    orderBy: { requestedAt: 'desc' },
    take: 20,
    select: { id: true, note: true, status: true, requestedAt: true, requester: { select: { firstName: true, lastName: true } } },
  })
}

export async function listMyRequests(memberId: string) {
  return prisma.mentorRequest.findMany({
    where: { requesterMemberId: memberId },
    orderBy: { requestedAt: 'desc' },
    take: 20,
    select: { id: true, status: true, requestedAt: true, mentor: { select: { member: { select: { firstName: true, lastName: true } } } } },
  })
}
