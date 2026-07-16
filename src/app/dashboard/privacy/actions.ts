'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import type { PrivacyTier } from '@prisma/client'

const VALID_TIERS: PrivacyTier[] = ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE', 'STEALTH', 'LOCKED']

export type FormState = { error?: string } | undefined

export async function updatePrivacyTier(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to change this.' }
  }

  const tier = formData.get('privacyTier') as PrivacyTier | null
  if (!tier || !VALID_TIERS.includes(tier)) {
    return { error: 'Please choose a valid privacy tier.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { privacyTier: tier },
  })

  revalidatePath('/dashboard/privacy')
  revalidatePath('/dashboard')
}

export async function setRecruiterDatabaseOptIn(optIn: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      recruiterDatabaseOptIn: optIn,
      recruiterDatabaseRequestedAt: optIn ? new Date() : null,
    },
  })

  captureServerEvent(profile.id, optIn ? 'recruiter_database_opt_in' : 'recruiter_database_opt_out')

  revalidatePath('/dashboard/privacy')
}

export type DeleteAccountFormState = { error?: string } | undefined

export async function deleteMyAccount(
  _prevState: DeleteAccountFormState,
  formData: FormData
): Promise<DeleteAccountFormState> {
  const confirmation = formData.get('confirmation') as string | null
  if (confirmation?.trim().toUpperCase() !== 'DELETE') {
    return { error: 'Type DELETE (all caps) to confirm.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  // Deletes the profile and every related row (references, resumes, work
  // samples, reports, etc.) via onDelete: Cascade on each relation.
  await prisma.candidateProfile.delete({ where: { id: profile.id } })

  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(user.id)

  await supabase.auth.signOut()

  redirect('/')
}
