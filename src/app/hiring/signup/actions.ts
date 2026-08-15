'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'

export type CompleteHiringManagerSignupState = { error?: string } | undefined

async function finishHiringManagerSignup(userId: string, fullName: string, workEmail: string, companyName: string) {
  const existing = await prisma.hiringManager.findUnique({ where: { workEmail } })
  const hiringManager = existing
    ? await prisma.hiringManager.update({ where: { id: existing.id }, data: { userId, fullName, companyName } })
    : await prisma.hiringManager.create({ data: { userId, fullName, workEmail, companyName } })

  await grantRoleIfMissing(userId, 'hiring_manager')

  captureServerEvent(hiringManager.id, 'hiring_manager_signup_completed', { hiringManagerId: hiringManager.id })
  return hiringManager
}

export async function completeHiringManagerSignup(
  _prevState: CompleteHiringManagerSignupState,
  formData: FormData
): Promise<CompleteHiringManagerSignupState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const companyName = (formData.get('companyName') as string | null)?.trim()

  if (!fullName) return { error: 'Please fill in your name.' }
  if (!companyName) return { error: 'Please fill in your company name.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  await finishHiringManagerSignup(user.id, fullName, user.email, companyName)

  redirect('/hiring')
}

// Called from CallbackHandler once a fresh hiring-manager signUp's
// confirmation email is clicked and a session is established — mirrors
// completeRecruiterSignupFromSession.
export async function completeHiringManagerSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) return { error: 'Something went wrong starting your session. Please try again.' }

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const companyName = (user.user_metadata?.company_name as string | undefined)?.trim()

  if (!fullName || !companyName) {
    return { error: 'Missing signup details — please try creating your account again.' }
  }

  await finishHiringManagerSignup(user.id, fullName, user.email, companyName)
  return {}
}
