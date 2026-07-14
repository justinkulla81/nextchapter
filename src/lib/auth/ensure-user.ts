import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Resolves the current authenticated user, lazily starting an anonymous
// Supabase session if none exists yet. Anonymous sessions let a candidate
// start uploading a resume and answering onboarding questions before they
// have a real account — account creation happens as the LAST onboarding
// step (see /onboarding/create-account), not the first.
export async function ensureUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return user

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    throw new Error('Could not start a session. Please try again.')
  }

  return data.user
}
