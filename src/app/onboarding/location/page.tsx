import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { LocationForm } from '@/components/onboarding/LocationForm'

export default async function LocationPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.onboardingResumeConfirmedAt) {
    redirect('/onboarding/confirm')
  }
  if (profile.onboardingLocationConfirmedAt) {
    redirect('/onboarding/comfort')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Where are you searching from?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This shapes which roles the Market Reality Grade weighs as realistic for you.
        </p>
      </div>
      <LocationForm profile={profile} />
    </div>
  )
}
