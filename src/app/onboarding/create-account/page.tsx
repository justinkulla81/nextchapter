import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { CreateAccountForm } from '@/components/onboarding/CreateAccountForm'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { progressOf } from '@/lib/onboarding/progress'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'
import { DETAILS_PATH, needsContactDetails } from '@/lib/onboarding/details'

export default async function CreateAccountPage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  // No account without a name: the résumé usually supplies it, otherwise the details step asks.
  if (needsContactDetails(profile)) redirect(DETAILS_PATH)

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

  // In the question bundles with Google connect on, the required Google step creates the account, so this form is not part of that
  // flow. With it off (until CASA) this form is that step: it comes after the five question steps, and a coach-invited member gives
  // consent before the account exists, the same order the Google step keeps.
  const bundles = flowOfProfile(profile) === 'bundles'
  if (bundles) {
    if (isGoogleConnectOn()) redirect('/onboarding')
    if (!progressOf(profile.journeyDetails).completed.includes('coach')) redirect('/onboarding')
    if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{bundles ? 'Last step: create your account.' : 'Your report is ready.'}</h1>
        <p className="mt-1 text-muted-foreground">
          {bundles ? 'Set a password and we’ll email you a confirmation link. Then you’ll see what we found.' : 'Set a password to see it — we’re emailing you a confirmation link now.'}
        </p>
      </div>
      <CreateAccountForm email={profile.email} confidentialSearchMode={profile.confidentialSearchMode} />
    </div>
  )
}
