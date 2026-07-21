'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import type { PrivacyTier, NotificationTier } from '@prisma/client'

const VALID_TIERS: PrivacyTier[] = ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE', 'STEALTH', 'LOCKED']
const VALID_NOTIFICATION_TIERS: NotificationTier[] = ['FULL', 'ESSENTIALS', 'MINIMAL']

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

export async function updateNotificationTier(
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

  const tier = formData.get('notificationTier') as NotificationTier | null
  if (!tier || !VALID_NOTIFICATION_TIERS.includes(tier)) {
    return { error: 'Please choose a valid notification setting.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { notificationTier: tier },
  })

  captureServerEvent(profile.id, 'notification_tier_updated', { tier })

  revalidatePath('/dashboard/privacy')
}

export async function updateSmsConsent(
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

  const consent = formData.get('smsConsent') === 'on'
  const smsPhone = (formData.get('smsPhone') as string | null)?.trim()

  if (consent && !smsPhone) {
    return { error: 'Enter a mobile number to opt in.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      smsPhone: smsPhone || null,
      smsConsentedAt: consent ? new Date() : null,
    },
  })

  captureServerEvent(profile.id, consent ? 'sms_consent_opted_in' : 'sms_consent_opted_out')

  revalidatePath('/dashboard/privacy')
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

// Revokes a coach's access (Prompt 54) — the only mechanism in this
// codebase that changes/removes coachId once set, and specifically clears
// coachDossierConsentedAt at the same time, since that's what actually
// gates the coach-facing Dossier/Coaching Notes read path.
export async function disconnectCoach(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { coachId: null, coachDossierConsentedAt: null },
  })

  captureServerEvent(profile.id, 'coach_disconnected')
  revalidatePath('/dashboard/privacy')
}

// Lets a candidate turn consent on later if they chose "Not right now"
// during onboarding — the only other place coachDossierConsentedAt is set.
export async function grantCoachDossierConsent(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.coachId) return

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { coachDossierConsentedAt: new Date() },
  })

  captureServerEvent(profile.id, 'coach_dossier_consent_granted')
  revalidatePath('/dashboard/privacy')
}
