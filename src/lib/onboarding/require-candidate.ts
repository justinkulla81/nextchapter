import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'

// The candidate for an onboarding action. The situation step is the first a session-less visitor can
// reach, so this lazily starts an anonymous session (ensureUser) rather than redirecting away.
//
// A coach's personal invite link stashes the nc_coach cookie before handing off to onboarding
// (see /api/coach-invite/[token]/route.ts); it is read at whichever action creates the profile first.
// getOrCreateCandidateProfile only consumes it on the actual create, so it is a no-op afterwards.
// Shared by the classic actions (src/app/onboarding/actions.ts) and the bundles (bundle-actions.ts).
export async function requireCandidateId(): Promise<string> {
  const supabase = await createClient()
  const user = await ensureUser(supabase)
  const cookieStore = await cookies()
  const coachId = cookieStore.get('nc_coach')?.value
  const profile = await getOrCreateCandidateProfile(user.id, { coachId })
  return profile.id
}
