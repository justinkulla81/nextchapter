import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'

export default async function OnboardingIndexPage() {
  const profile = await getCandidateProfileForUser()

  if (profile.assessmentComplete && profile.registrationCompletedAt) redirect('/dashboard')
  if (!profile.resumeStepComplete) redirect('/onboarding/resume')
  if (!profile.desireComplete) redirect('/onboarding/desire')
  if (!profile.part1Complete) redirect('/onboarding/circumstances')
  if (!profile.part3Complete) redirect('/onboarding/experience')
  if (!profile.part4Complete) redirect('/onboarding/goals')
  if (!profile.contractAcceptedAt) redirect('/onboarding/contract')
  if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding/coach-consent')
  if (!profile.registrationCompletedAt) redirect('/onboarding/score')
  redirect('/dashboard')
}
