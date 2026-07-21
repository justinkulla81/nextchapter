import 'server-only'
import { prisma } from '@/lib/prisma'

export interface ExistingAccountMatch {
  id: string
  passwordSetAt: Date | null
}

// Looks up whether a DIFFERENT, already-registered candidate account already
// owns this email — used to block a second account for the same person from
// completing registration, both pre-emptively (CreateAccountForm, before an
// email confirmation link is even sent) and authoritatively
// (syncRegistrationCompletion, the one place registrationCompletedAt itself
// gets stamped, which every registration path funnels through).
export async function findExistingRegisteredAccount(
  email: string,
  excludeProfileId: string
): Promise<ExistingAccountMatch | null> {
  return prisma.candidateProfile.findFirst({
    where: {
      id: { not: excludeProfileId },
      registrationCompletedAt: { not: null },
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true, passwordSetAt: true },
  })
}
