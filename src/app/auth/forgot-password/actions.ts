'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type ForgotPasswordState = { error?: string; sent?: boolean } | undefined

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) {
    return { error: 'Please enter your email.' }
  }

  // Deliberately no "does an account exist" pre-check: this used to query
  // CandidateProfile, which only covers completed candidate registrations
  // — any other real Supabase user (an admin-only login, employer,
  // recruiter, coach) has no CandidateProfile row at all and would get a
  // false "no account" answer, exactly the bug that left a real, previously
  // logged-in account unable to ever receive a reset email. Supabase's own
  // resetPasswordForEmail already no-ops safely for an email with no
  // matching user (no error, nothing sent) — checking against the wrong
  // table only made this worse for anyone outside the candidate table.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const admin = createAdminClient()
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { sent: true }
}
