'use server'

import { redirect } from 'next/navigation'
import type { CoachingFocus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'

export type CompleteCoachSignupState = { error?: string } | undefined

const FOCUS_OPTIONS: CoachingFocus[] = ['CAREER', 'LIFE', 'EXECUTIVE', 'EOS', 'OTHER']

async function finishCoachSignup(
  userId: string,
  fullName: string,
  workEmail: string,
  firmName: string | null,
  focus: CoachingFocus
) {
  // A coach who ran the old (pre-login) P0-lite flow may already have a
  // token-only row under this same work email — link this new login to it
  // rather than creating a duplicate.
  const existing = await prisma.coach.findUnique({ where: { workEmail } })
  const coach = existing
    ? await prisma.coach.update({ where: { id: existing.id }, data: { userId, fullName, firmName, focus } })
    : await prisma.coach.create({ data: { userId, fullName, workEmail, firmName, focus } })

  await grantRoleIfMissing(userId, 'coach')

  captureServerEvent(coach.id, 'coach_signup_completed', { coachId: coach.id })
  return coach
}

export async function completeCoachSignup(
  _prevState: CompleteCoachSignupState,
  formData: FormData
): Promise<CompleteCoachSignupState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const focus = formData.get('focus') as CoachingFocus | null

  if (!fullName || !focus || !FOCUS_OPTIONS.includes(focus)) {
    return { error: 'Please fill in your name and coaching focus.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Something went wrong starting your session. Please try again.' }
  }

  await finishCoachSignup(user.id, fullName, user.email, firmName, focus)

  redirect('/support/coach')
}

// Called from CallbackHandler once a fresh coach signUp's confirmation
// email is clicked and a session is established — mirrors
// completeEmployerSignupFromSession (see src/app/talent/signup/actions.ts).
export async function completeCoachSignupFromSession(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) return { error: 'Something went wrong starting your session. Please try again.' }

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const firmName = ((user.user_metadata?.firm_name as string | undefined)?.trim() || null) as string | null
  const focus = user.user_metadata?.focus as CoachingFocus | undefined

  if (!fullName || !focus || !FOCUS_OPTIONS.includes(focus)) {
    return { error: 'Missing signup details — please try creating your account again.' }
  }

  await finishCoachSignup(user.id, fullName, user.email, firmName, focus)
  return {}
}
