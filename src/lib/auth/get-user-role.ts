import 'server-only'
import { prisma } from '@/lib/prisma'

export type UserRole = 'employer' | 'candidate' | 'none'

// Employer takes precedence in the unlikely event both rows exist for the
// same userId — there's no real path to that today, but the check order
// matters if one ever opens up.
export async function getUserRole(userId: string): Promise<UserRole> {
  const employer = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (employer) return 'employer'

  const candidate = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (candidate) return 'candidate'

  return 'none'
}
