import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'

export async function getCandidateProfileForUser() {
  const user = await getCurrentUser()

  if (!user) {
    // No session at all (not even anonymous) — send them to the actual
    // first step, which lazily starts an anonymous session (see
    // requireCandidateId in onboarding/actions.ts), rather than a login
    // page that implies a password is required.
    redirect('/onboarding/desire')
  }

  // An admin, hiring manager, recruiter, or coach who ends up here by
  // mistake should never silently get a stray CandidateProfile created.
  await redirectIfNotCandidate(user.id, user.email)

  const profile = await getOrCreateCandidateProfile(user.id)
  const { profile: synced } = await syncRegistrationCompletion(user, profile)
  return synced
}
