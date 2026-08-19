import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { ComfortForm } from '@/components/onboarding/ComfortForm'

export default async function ComfortPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.onboardingSearchStatusConfirmedAt) {
    redirect('/onboarding/location')
  }
  if (profile.onboardingComfortConfirmedAt) {
    redirect('/onboarding/contract')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">One more thing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How comfortable do you feel letting your network know you&apos;re looking for a role?
        </p>
      </div>
      <ComfortForm profile={profile} />
    </div>
  )
}
