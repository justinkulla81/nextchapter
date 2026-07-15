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
        <h1 className="text-2xl font-semibold tracking-tight">Your report is ready.</h1>
        <p className="mt-1 text-muted-foreground">Enter your email and we&apos;ll send it now.</p>
      </div>
      <CreateAccountForm defaultEmail={profile.email} />
    </div>
  )
}
