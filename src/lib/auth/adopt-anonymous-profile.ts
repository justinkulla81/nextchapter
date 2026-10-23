import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AdoptResult = 'adopted' | 'none' | 'skipped'

// The answers a visitor gave before signing up live on a profile that belongs to their anonymous session. When
// they continue with Google, that profile is moved onto the new account so nothing they typed is lost (the
// profile row keeps its id, so everything attached to it comes along).
//
// 'none'    there was nothing to move.
// 'skipped' the Google account already has its own profile, so it is left exactly as it is and the anonymous
//           answers are not merged into it. Never overwrite an existing member.
export async function adoptAnonymousProfile(anonymousUserId: string, newUserId: string): Promise<AdoptResult> {
  if (anonymousUserId === newUserId) return 'none'

  const profile = await prisma.candidateProfile.findUnique({ where: { userId: anonymousUserId }, select: { id: true } })
  if (!profile) return 'none'

  const taken = await prisma.candidateProfile.findUnique({ where: { userId: newUserId }, select: { id: true } })
  if (taken) return 'skipped'

  try {
    await prisma.$transaction([
      prisma.candidateProfile.update({ where: { id: profile.id }, data: { userId: newUserId } }),
      // The candidate role granted when the anonymous profile was created.
      prisma.roleGrant.updateMany({ where: { userId: anonymousUserId }, data: { userId: newUserId } }),
    ])
  } catch (error) {
    // A profile for the new account appeared between the check and the move: leave both alone.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'skipped'
    throw error
  }
  return 'adopted'
}
