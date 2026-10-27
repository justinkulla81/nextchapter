import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { accountStepPath, afterAccountPath, nextPreAccountPath, progressOf } from '@/lib/onboarding/progress'

export default async function OnboardingIndexPage() {
  const profile = await getCandidateProfileForUser()

  // The short question bundles (docs/personalization-audit/bundles.md): five question steps, then one required step that creates
  // the account ("Continue with Google" when Google connect is on, otherwise an email and a password; see
  // src/lib/google/connect-switch.ts); then the payoff and the welcome.
  // Members on the classic screens fall through to the chain below, unchanged.
  if (flowOfProfile(profile) === 'bundles') {
    // This email already belongs to another registered account: that page says so and offers a way in.
    if (profile.duplicateEmailBlockedAt) redirect('/onboarding/create-account')
    if (profile.assessmentComplete && profile.registrationCompletedAt) {
      redirect(afterAccountPath({ ...progressOf(profile.journeyDetails), introCommitted: !!profile.introCommittedAt }))
    }
    const next = nextPreAccountPath(profile)
    const accountStep = accountStepPath()
    if (next !== accountStep) redirect(next)
    // Coach-invited members still give consent and fill in their intake before the account step.
    if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding/coach-consent')
    if (profile.coachId && profile.coachDossierConsentedAt && !(await hasSubmittedCoachingOnboardingForm(profile.id))) {
      redirect('/onboarding/coaching-form')
    }
    redirect(accountStep)
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
