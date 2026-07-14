'use server'

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'

export type ForgotPasswordState = { error?: string; sent?: boolean; noAccount?: boolean } | undefined

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) {
    return { error: 'Please enter your email.' }
  }

  // Anonymous onboarding-in-progress profiles share the email column too —
  // only a completed registration (registrationCompletedAt set) has a real
  // password to reset, so that's the bar for "an activated account exists."
  const existingAccount = await prisma.candidateProfile.findFirst({
    where: {
      registrationCompletedAt: { not: null },
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
  })

  if (!existingAccount) {
    return { noAccount: true }
  }

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
