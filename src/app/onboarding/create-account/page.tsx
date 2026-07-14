import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { CreateAccountForm } from '@/components/onboarding/CreateAccountForm'

export default async function CreateAccountPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Nice work, ${profile.firstName}!` : 'One last step'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Confirm your email to create your account and unlock your full Hireability Report — no
          password needed, we&apos;ll email you a link.
        </p>
      </div>
      <CreateAccountForm defaultEmail={profile.email} />
    </div>
  )
}
