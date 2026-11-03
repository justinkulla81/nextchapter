import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

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
//
// "Registered" is registrationCompletedAt OR passwordSetAt. registrationCompletedAt
// is only stamped on the next authenticated request after the confirmation link
// is clicked, so a member who confirmed in one browser and started onboarding
// again in another (a fresh anonymous session) was invisible to this check until
// they signed in (2026-11-03, Chris Bates: two profiles ten minutes apart).
// passwordSetAt is written only after the member has confirmed the link and set
// a password (or linked Google), so it can't be set by someone who merely typed
// an email.
export async function findExistingRegisteredAccount(
  email: string,
  excludeProfileId: string
): Promise<ExistingAccountMatch | null> {
  return prisma.candidateProfile.findFirst({
    where: {
      id: { not: excludeProfileId },
      OR: [{ registrationCompletedAt: { not: null } }, { passwordSetAt: { not: null } }],
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true, passwordSetAt: true },
  })
}

// Non-destructive version of the check, for the moment an email first lands on
// an unregistered profile (résumé read, the create-account email fallback). If
// a registered account already owns it, mark this profile blocked so
// /onboarding sends the visitor to the "You already have an account" screen
// instead of letting them redo the flow and become a second profile. It never
// deletes, so it is safe to call while background work is still writing to the
// profile. A profile that is itself registered is never flagged.
export async function flagIfDuplicateAccount(
  profileId: string,
  email: string,
  source: string
): Promise<ExistingAccountMatch | null> {
  const existing = await findExistingRegisteredAccount(email, profileId)
  if (!existing) return null

  const flagged = await prisma.candidateProfile.updateMany({
    where: { id: profileId, registrationCompletedAt: null, duplicateEmailBlockedAt: null },
    data: { duplicateEmailBlockedAt: new Date() },
  })
  if (flagged.count > 0) captureServerEvent(profileId, 'duplicate_account_blocked', { email, source, existingCandidateId: existing.id })
  return existing
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
