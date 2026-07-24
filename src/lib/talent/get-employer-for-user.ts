import 'server-only'
import { prisma } from '@/lib/prisma'
import type { EmployerProfile } from '@prisma/client'

// Team seats (EmployerSeat) are additive to the original single-owner
// EmployerProfile.userId — resolve the owner first (every existing
// single-user employer account keeps working through this path, completely
// unaffected by whether any seats exist), then fall back to an accepted
// seat. This is the one place employer auth resolution should happen so
// every page/action that gates on "is this person this employer" picks up
// seat members automatically.
export async function resolveEmployerForUserId(userId: string): Promise<EmployerProfile | null> {
  const owned = await prisma.employerProfile.findUnique({ where: { userId } })
  if (owned) return owned

  const seat = await prisma.employerSeat.findFirst({
    where: { userId, acceptedAt: { not: null } },
    include: { employer: true },
  })
  return seat?.employer ?? null
}
