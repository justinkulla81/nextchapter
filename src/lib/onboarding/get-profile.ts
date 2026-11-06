import { redirect } from 'next/navigation'
import { getCurrentUser, getSessionIdentity } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'

/**
 * The signed-in candidate's profile, with the registration sync (a confirmed account stamps registrationCompletedAt).
 * `registrationSync: false` is for the pre-account question steps (aiming, where, coach): they route nowhere on
 * registration, and an anonymous session cannot complete it, so they skip the full user lookup and the sync. The token
 * claims can lag a confirmation made in another browser, so the pages that do route on registration keep the default.
 */
export async function getCandidateProfileForUser({ registrationSync = true }: { registrationSync?: boolean } = {}) {
  const session = await getSessionIdentity()

  if (!session) {
    // No session at all (not even anonymous) — send them to the actual
    // first step, which lazily starts an anonymous session (see
    // requireCandidateId in onboarding/actions.ts), rather than a login
    // page that implies a password is required.
    redirect('/onboarding/desire')
  }

  // An admin, hiring manager, recruiter, or coach who ends up here by
  // mistake should never silently get a stray CandidateProfile created.
  await redirectIfNotCandidate(session.id, session.email)

  const profile = await getOrCreateCandidateProfile(session.id)
  // An anonymous session cannot be the moment registration completes (syncRegistrationCompletion returns at once for
  // it, and it holds no Google identity), so a caller that does not route on registration skips both calls.
  if (!registrationSync && session.isAnonymous) return profile
  const user = await getCurrentUser()
  if (!user) return profile
  const { profile: synced } = await syncRegistrationCompletion(user, profile)
  return synced
}
