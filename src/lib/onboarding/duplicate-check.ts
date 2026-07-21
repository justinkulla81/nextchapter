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

// Runs the same check and, if it finds a match, persists duplicateEmailBlockedAt
// on the calling profile in the same step — used by every place that needs to
// both check AND record the block (resume-upload, and a returning visit to
// /onboarding/resume that skips re-uploading because resumeStepComplete is
// already true) so the flag is set the moment the collision is first seen,
// not just when registration is finally attempted.
export async function checkAndFlagDuplicateEmail(
  profileId: string,
  email: string
): Promise<ExistingAccountMatch | null> {
  const existing = await findExistingRegisteredAccount(email, profileId)
  if (existing) {
    await prisma.candidateProfile.update({
      where: { id: profileId },
      data: { duplicateEmailBlockedAt: new Date() },
    })
  }
  return existing
}
