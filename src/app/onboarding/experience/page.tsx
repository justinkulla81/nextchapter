import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { ExperienceForm } from '@/components/onboarding/ExperienceForm'

export default async function ExperiencePage() {
  const profile = await getCandidateProfileForUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your track record</h1>
        <p className="mt-1 text-muted-foreground">
          The short version — enough for an employer to know what you bring.
        </p>
      </div>
      <ExperienceForm profile={profile} />
    </div>
  )
}
