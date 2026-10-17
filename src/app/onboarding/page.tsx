import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'

export default async function OnboardingIndexPage() {
  const profile = await getCandidateProfileForUser()

  if (profile.assessmentComplete && profile.registrationCompletedAt) redirect('/dashboard')
  // Onboarding v2: someone who has already signed up with Google continues on
  // the reveal, not the classic situation step.
  if (isOnboardingV2Enabled() && !profile.desireComplete) {
    const user = await getCurrentUser()
    if (user && !user.is_anonymous) redirect('/onboarding/reveal')
  }
  if (!profile.desireComplete) redirect('/onboarding/desire')
  if (!profile.resumeStepComplete) redirect('/onboarding/resume')
  if (!profile.onboardingResumeConfirmedAt) redirect('/onboarding/confirm')
  if (!profile.onboardingLocationConfirmedAt) redirect('/onboarding/location')
  if (!profile.onboardingComfortConfirmedAt) redirect('/onboarding/comfort')
  if (!profile.contractAcceptedAt) redirect('/onboarding/contract')
  if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding/coach-consent')
  // Prompt 60 — defense in depth: submitCoachConsent already routes straight
  // here on "agree", but a candidate could land back on this hub directly.
  if (
    profile.coachId &&
    profile.coachDossierConsentedAt &&
    !(await hasSubmittedCoachingOnboardingForm(profile.id))
  ) {
    redirect('/onboarding/coaching-form')
  }
  if (!profile.registrationCompletedAt) redirect('/onboarding/score')
  if (!profile.introCommittedAt) redirect('/onboarding/welcome')
  redirect('/dashboard')
}
