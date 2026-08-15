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

// Runs the same check and, if it finds a match, DELETES the calling profile
// (cascades to its Resume/analysis/etc rows) instead of just flagging it —
// used by the two places that catch this collision before a real account
// exists yet (resume-upload, and a returning visit to /onboarding/resume
// that skips re-uploading because resumeStepComplete is already true).
// There must never be two CandidateProfile rows for the same person: an
// anonymous session that turns out to already have a real account should be
// deleted outright and sent to log in, not left behind as an orphaned
// duplicate. This is deliberately NOT the same behavior as
// duplicateEmailBlockedAt/sync-registration.ts's flagging — that path fires
// AFTER a real email confirmation, where the candidate has genuinely
// invested in the flow and deleting their in-progress answers would be far
// more destructive than here, where nothing but this one upload attempt
// exists yet.
export async function checkAndDeleteDuplicateProfile(
  profileId: string,
  email: string
): Promise<ExistingAccountMatch | null> {
  const existing = await findExistingRegisteredAccount(email, profileId)
  if (existing) {
    await prisma.candidateProfile.delete({ where: { id: profileId } })
  }
  return existing
}
