'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'

export type CompleteRecruiterSignupState = { error?: string } | undefined

async function finishRecruiterSignup(
  userId: string,
  fullName: string,
  workEmail: string,
  firmName: string | null,
  specialty: string | null
) {
  // A recruiter who ran the old (pre-login) P0-lite flow may already have a
  // token-only row under this same work email — link this new login to it
  // rather than creating a duplicate.
  const existing = await prisma.recruiter.findUnique({ where: { workEmail } })
  const recruiter = existing
    ? await prisma.recruiter.update({ where: { id: existing.id }, data: { userId, fullName, firmName, specialty } })
    : await prisma.recruiter.create({ data: { userId, fullName, workEmail, firmName, specialty } })

  await grantRoleIfMissing(userId, 'recruiter')

  captureServerEvent(recruiter.id, 'recruiter_signup_completed', { recruiterId: recruiter.id })
  return recruiter
}

export async function completeRecruiterSignup(
  _prevState: CompleteRecruiterSignupState,
  formData: FormData
): Promise<CompleteRecruiterSignupState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const specialty = (formData.get('specialty') as string | null)?.trim() || null

  if (!fullName) {
    return { error: 'Please fill in your name.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  await finishRecruiterSignup(user.id, fullName, user.email, firmName, specialty)

  redirect('/recruiters/dashboard')
}

// Called from CallbackHandler once a fresh recruiter signUp's confirmation
// email is clicked and a session is established — mirrors
// completeEmployerSignupFromSession (see src/app/talent/signup/actions.ts).
export async function completeRecruiterSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) return { error: 'Something went wrong starting your session. Please try again.' }

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const firmName = ((user.user_metadata?.firm_name as string | undefined)?.trim() || null) as string | null
  const specialty = ((user.user_metadata?.specialty as string | undefined)?.trim() || null) as string | null

  if (!fullName) {
    return { error: 'Missing signup details — please try creating your account again.' }
  }

  await finishRecruiterSignup(user.id, fullName, user.email, firmName, specialty)
  return {}
}
