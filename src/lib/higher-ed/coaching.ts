// Coaching for colleges (product design: "Coaching: the college's own
// coaches, NextChapter coaches, or both"). There is no college coaching
// workspace: members choose and book coaches in the candidate portal, and a
// college's own coaches work in the regular coach portal with
// Coach.institutionId set. This file is the link between the two.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'

// The college a new session counts toward: the coach's college, when the
// client is a member of it. Null otherwise.
export async function collegeForSession(coachId: string, candidateId: string): Promise<string | null> {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { institutionId: true } })
  if (!coach?.institutionId) return null
  const member = await prisma.institutionMember.findFirst({
    where: { candidateId, institutionId: coach.institutionId },
    select: { id: true },
  })
  return member ? coach.institutionId : null
}

// A college invites one of its coaches (Admin › Staff, role COACH). On
// accepting, they get a coach-portal profile tied to the college — or their
// existing one is linked — and the coach role.
export async function linkCollegeCoach(args: { userId: string; email: string; fullName: string | null; institutionId: string }): Promise<void> {
  const email = args.email.toLowerCase()
  const existing = await prisma.coach.findFirst({
    where: { OR: [{ userId: args.userId }, { workEmail: email }] },
    select: { id: true },
  })
  if (existing) {
    await prisma.coach.update({ where: { id: existing.id }, data: { userId: args.userId, institutionId: args.institutionId } })
  } else {
    await prisma.coach.create({
      data: {
        fullName: args.fullName?.trim() || email.split('@')[0],
        workEmail: email,
        focus: 'CAREER',
        userId: args.userId,
        institutionId: args.institutionId,
        industries: [],
        seniorityFit: [],
        certifications: [],
        specializationTags: [],
        languages: [],
      },
    })
  }
  await grantRoleIfMissing(args.userId, 'coach')
}
