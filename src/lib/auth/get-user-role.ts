import 'server-only'
import { prisma } from '@/lib/prisma'

export type UserRole = 'employer' | 'recruiter' | 'coach' | 'candidate' | 'none'

// Employer/recruiter/coach take precedence over candidate in the unlikely
// event both rows exist for the same userId — there's no real path to that
// today (each role signs up under its own account), but the check order
// matters if one ever opens up.
export async function getUserRole(userId: string): Promise<UserRole> {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (employer) return 'employer'

  const recruiter = await prisma.recruiter.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (recruiter) return 'recruiter'

  const coach = await prisma.coach.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (coach) return 'coach'

  const candidate = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (candidate) return 'candidate'

  return 'none'
}
