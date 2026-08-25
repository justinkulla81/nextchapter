'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateEqOverIqContributorProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'

// Called from CallbackHandler once a fresh (non-anonymous) contributor
// signUp's confirmation email is clicked and a session is established — the
// signup form itself never got a session to finish the profile with, so the
// name it collected rides along in user_metadata instead. Mirrors
// completeCrucibleEmployerSignupFromSession exactly.
export async function completeEqOverIqContributorSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient('eqoveriq')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Something went wrong starting your session. Please try again.' }

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim()

  const profile = await getOrCreateEqOverIqContributorProfile(user.id, fullName ?? '')
  if (fullName && fullName !== profile.fullName) {
    await prisma.eqOverIqContributorProfile.update({ where: { id: profile.id }, data: { fullName } })
  }

  captureServerEvent(user.id, 'eqoveriq_contributor_signup_completed', {})
  return {}
}
