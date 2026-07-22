import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { CreateAccountForm } from '@/components/onboarding/CreateAccountForm'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'

export default async function CreateAccountPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  // Authoritative block from syncRegistrationCompletion — the confirmed
  // email already belongs to another registered account. The client-side
  // pre-check in CreateAccountForm catches most of these before an email is
  // even sent; this covers everything else that reaches non-anonymous
  // (Google-linking, a race, a differently-typed email), since this is the
  // one page every such session lands back on.
  if (profile.duplicateEmailBlockedAt) {
    const existing = profile.email
      ? await findExistingRegisteredAccount(profile.email, profile.id)
      : null
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">You already have an account</h1>
        <ExistingAccountNotice
          needsPassword={!existing?.passwordSetAt}
          email={profile.email}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your report is ready.</h1>
        <p className="mt-1 text-muted-foreground">
          Confirm your email to set a password and see it.
        </p>
      </div>
      <CreateAccountForm email={profile.email} />
    </div>
  )
}
