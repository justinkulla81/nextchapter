import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { syncRegistrationCompletion } from '@/lib/onboarding/sync-registration'

export async function getCandidateProfileForUser() {
  const user = await getCurrentUser()

  if (!user) {
    // No session at all (not even anonymous) — send them to the actual
    // first step, which lazily starts an anonymous session on upload,
    // rather than a login page that implies a password is required.
    redirect('/onboarding/resume')
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  const { profile: synced } = await syncRegistrationCompletion(user, profile)
  return synced
}
