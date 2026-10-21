import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { BundleShell } from '@/components/onboarding/bundles/BundleShell'
import { BundleForm } from '@/components/onboarding/bundles/BundleForm'
import { submitCoach } from '@/app/onboarding/bundle-actions'
import { effectiveJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { storedAnswers } from '@/lib/onboarding/answers'
import { usableAnswers } from '@/lib/onboarding/bundles'

// O5, "How we coach you". Only part of the short question bundles; the classic flow asks tone on the location screen.
export default async function CoachBundlePage() {
  const profile = await getCandidateProfileForUser()
  // Registered members can still come back to change their tone (the personalization strip links here); saving
  // sends them on through the finish screen, which sends a registered member to their dashboard.
  if (flowOfProfile(profile) !== 'bundles') redirect('/onboarding')
  if (!profile.onboardingLocationConfirmedAt) redirect('/onboarding/location')

  const journey = effectiveJourney(profile)
  return (
    <BundleShell id="coach">
      <BundleForm
        bundle="coach"
        initial={usableAnswers('coach', { journey }, storedAnswers(profile))}
        storedJourney={journey}
        payoffInput={{ storedStage: profile.journeyStage, storedIntensity: profile.searchIntensity }}
        action={submitCoach}
      />
    </BundleShell>
  )
}
