'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateEmployerProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export type CompleteEmployerSignupState = { error?: string } | undefined

async function finishEmployerSignup(userId: string, contactName: string, companyName: string) {
  const profile = await getOrCreateEmployerProfile(userId, companyName)

  await prisma.employerProfile.update({
    where: { id: profile.id },
    data: {
      contactName,
      companyName,
      noGhostingCommitmentAccepted: true,
      noGhostingCommitmentAcceptedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'talent_signup_completed', { employerId: profile.id })
}

export async function completeEmployerSignup(
  _prevState: CompleteEmployerSignupState,
  formData: FormData
): Promise<CompleteEmployerSignupState> {
  const contactName = (formData.get('contactName') as string | null)?.trim()
  const companyName = (formData.get('companyName') as string | null)?.trim()
  const noGhostingAccepted = formData.get('noGhostingAccepted') === 'on'

  if (!contactName || !companyName) {
    return { error: 'Please fill in your name and company name.' }
  }
  if (!noGhostingAccepted) {
    return { error: 'Please acknowledge the No-Ghosting Commitment to continue.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  await finishEmployerSignup(user.id, contactName, companyName)

  redirect('/talent/roles/new')
}

// Called from CallbackHandler once a fresh (non-anonymous) employer signUp's
// confirmation email is clicked and a session is established — the signup
// form itself never got a session to call completeEmployerSignup with, so
// the contact/company name it collected rides along in user_metadata instead.
export async function completeEmployerSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Something went wrong starting your session. Please try again.' }

  const contactName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const companyName = (user.user_metadata?.company_name as string | undefined)?.trim()

  if (!contactName || !companyName) {
    return { error: 'Missing signup details — please try creating your account again.' }
  }

  await finishEmployerSignup(user.id, contactName, companyName)
  return {}
}
