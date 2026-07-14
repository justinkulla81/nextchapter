import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { CircumstancesForm } from '@/components/onboarding/CircumstancesForm'

export default async function CircumstancesPage() {
  const profile = await getCandidateProfileForUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `${profile.firstName}, tell me where things stand` : 'Tell me where things stand'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          There&apos;s no wrong answer here. This helps employers understand your context before they
          ever see your name.
        </p>
      </div>
      <CircumstancesForm profile={profile} />
    </div>
  )
}
