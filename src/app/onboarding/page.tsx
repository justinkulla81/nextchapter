import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { nextPreAccountPath, progressOf } from '@/lib/onboarding/progress'

export default async function OnboardingIndexPage() {
  const profile = await getCandidateProfileForUser()

  // The short question bundles (docs/personalization-audit/bundles.md): five bundles, the finish screen, then the
  // account, then the Google reveal. Members on the classic screens fall through to the chain below, unchanged.
  if (flowOfProfile(profile) === 'bundles') {
    if (profile.assessmentComplete && profile.registrationCompletedAt) {
      if (!progressOf(profile.journeyDetails).googleRevealAt) redirect('/onboarding/google')
      redirect(profile.introCommittedAt ? '/dashboard' : '/onboarding/welcome')
    }
    const next = nextPreAccountPath(profile)
    if (next !== '/onboarding/score') redirect(next)
    // Coach-invited members still give consent and fill in their intake before the account step.
    if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding/coach-consent')
    if (profile.coachId && profile.coachDossierConsentedAt && !(await hasSubmittedCoachingOnboardingForm(profile.id))) {
      redirect('/onboarding/coaching-form')
    }
    redirect('/onboarding/score')
  }

  if (profile.assessmentComplete && profile.registrationCompletedAt) redirect('/dashboard')
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
