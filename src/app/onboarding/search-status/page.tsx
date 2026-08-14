import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { SearchStatusForm } from '@/components/onboarding/SearchStatusForm'

export default async function SearchStatusPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.onboardingLocationConfirmedAt) {
    redirect('/onboarding/location')
  }
  if (profile.onboardingSearchStatusConfirmedAt) {
    redirect('/onboarding/comfort')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Where are you in your search?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This tells us which part of the process to focus on first.
        </p>
      </div>
      <SearchStatusForm profile={profile} />
    </div>
  )
}
