'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCrucibleEmployerProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'

// Called from CallbackHandler once a fresh (non-anonymous) NEN employer
// signUp's confirmation email is clicked and a session is established — the
// signup form itself never got a session to finish the profile with, so the
// contact/company name it collected rides along in user_metadata instead.
// Mirrors completeEmployerSignupFromSession (src/app/talent/signup/actions.ts).
export async function completeCrucibleEmployerSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient('nen')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Something went wrong starting your session. Please try again.' }

  const contactName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const companyName = (user.user_metadata?.company_name as string | undefined)?.trim()

  if (!companyName) {
    return { error: 'Missing signup details — please try creating your account again.' }
  }

  const profile = await getOrCreateCrucibleEmployerProfile(user.id, companyName)
  if (contactName && contactName !== profile.contactName) {
    await prisma.crucibleEmployerProfile.update({ where: { id: profile.id }, data: { contactName } })
  }

  captureServerEvent(user.id, 'employer_signup_completed', { companyName })
  return {}
}
