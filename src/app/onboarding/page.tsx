import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'

export default async function OnboardingIndexPage() {
  const profile = await getCandidateProfileForUser()

  if (profile.assessmentComplete && profile.registrationCompletedAt) redirect('/dashboard')
  if (!profile.desireComplete) redirect('/onboarding/desire')
  if (!profile.resumeStepComplete) redirect('/onboarding/resume')
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
