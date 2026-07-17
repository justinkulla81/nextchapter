import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { SituationForm } from '@/components/onboarding/SituationForm'

export default async function SituationPickerPage() {
  const profile = await getCandidateProfileForUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Hi ${profile.firstName}, which of these sounds like you?` : 'Which of these sounds like you?'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick the one that fits best — we&apos;ll tailor your Hireability Assessment to your situation.
        </p>
      </div>
      <SituationForm />
    </div>
  )
}
