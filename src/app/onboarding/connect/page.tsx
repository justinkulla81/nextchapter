import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { progressOf } from '@/lib/onboarding/progress'
import { joinErrorMessage } from '@/lib/onboarding/join-errors'
import { Meter } from '@/components/candidate/ui'
import { JoinWithGoogle } from '@/components/onboarding/JoinWithGoogle'
import { JoinErrorNotice } from '@/components/onboarding/JoinErrorNotice'
import { NoGmailWaitlist } from '@/components/onboarding/bundles/NoGmailWaitlist'

export const metadata: Metadata = { title: 'Continue with Google', robots: { index: false, follow: false } }

// The required last step of the onboarding question bundles: one Google sign-in creates the account and connects Gmail
// and Calendar. Nothing here can be skipped; people with no personal Gmail can leave their email instead.
export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCandidateProfileForUser()

  if (flowOfProfile(profile) !== 'bundles') redirect('/onboarding')
  // Already has an account: the hub knows where they go next.
  if (profile.registrationCompletedAt) redirect('/onboarding')
  // The five question steps come first, and a coach-invited member gives consent before the account exists.
  if (!progressOf(profile.journeyDetails).completed.includes('coach')) redirect('/onboarding')
  if (profile.coachId && !profile.coachDossierConsentedAt) redirect('/onboarding')

  const { error } = await searchParams
  const message = joinErrorMessage(error)

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Last step</p>
        <Meter pct={100} label="Last step" />
      </div>

      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">Continue with Google</h1>
        <p className="text-base text-muted-foreground">
          This creates your account and connects your Gmail and Calendar, so your applications, interviews and conversations count themselves, and your effort is real to employers. It takes one click.
        </p>
      </div>

      {error && message && <JoinErrorNotice code={error} message={message} />}

      <section aria-labelledby="what-we-read" className="space-y-3">
        <h2 id="what-we-read" className="text-base font-semibold text-ink">
          What we read, and what we don’t do
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>We read your Gmail and Calendar, read-only, looking for job-search email and events from the last 3 months.</li>
          <li>We keep what we find (the company, role, date and subject line), not the text of your messages.</li>
          <li>We never send, delete or share anything. You can disconnect at any time.</li>
          <li>Personal Gmail accounts only for now, so your search stays private from your employer.</li>
        </ul>
      </section>

      <JoinWithGoogle />

      <NoGmailWaitlist />
    </div>
  )
}
