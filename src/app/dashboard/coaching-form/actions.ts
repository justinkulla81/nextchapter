'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  getCoachTemplate,
  hasSubmittedCoachingOnboardingForm,
  submitCoachingOnboardingForm,
  validateAnswers,
  type CoachingOnboardingAnswers,
} from '@/lib/coach/onboarding-form'
import { submitConfidentialDisclosure } from '@/lib/coach/confidential-disclosure'

// Prompt 60 — dashboard-side entry point, for existing candidates who grant
// coach consent later via /dashboard/privacy rather than during onboarding.
export async function submitCoachingOnboardingFormDashboard(
  answers: CoachingOnboardingAnswers
): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.coachId || !profile.coachDossierConsentedAt) {
    redirect('/dashboard')
  }
  if (await hasSubmittedCoachingOnboardingForm(profile.id)) {
    redirect('/dashboard')
  }

  const template = await getCoachTemplate(profile.coachId)
  const errors = validateAnswers(template, answers)
  if (errors.length > 0) {
    return { error: 'Please answer every required question before continuing.' }
  }

  await submitCoachingOnboardingForm(profile.id, profile.coachId, answers)
  captureServerEvent(profile.id, 'coaching_onboarding_form_submitted', { source: 'dashboard' })

  // Stay on this page rather than /dashboard — the optional confidential
  // disclosure step renders next, once the main kickoff form is done.
  redirect('/dashboard/coaching-form')
}

export async function submitConfidentialDisclosureDashboard(hasDisclosure: boolean, disclosureText: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.coachId) return

  await submitConfidentialDisclosure(profile.id, profile.coachId, hasDisclosure, disclosureText)
  captureServerEvent(profile.id, 'coaching_confidential_disclosure_submitted', { hasDisclosure })
}
