import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { getScanSummary } from '@/lib/onboarding/scan-summary'
import { isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'
import { Button } from '@/components/ui/button'
import { ScanReveal, type TrackingOutcome } from '@/components/onboarding/ScanReveal'
import { SituationForm } from '@/components/onboarding/SituationForm'
import { submitRevealSituation } from './actions'

export const metadata: Metadata = { title: 'Reading your search', robots: { index: false, follow: false } }

function trackingOutcome(value: string | undefined): TrackingOutcome {
  return value === 'on' || value === 'pending' || value === 'off' ? value : null
}

// Onboarding v2, after sign-up: the first inbox read happens in front of the
// member while they answer the one question the assessment needs. When both are
// done, one button carries on to the welcome page.
export default async function RevealPage({ searchParams }: { searchParams: Promise<{ tracking?: string }> }) {
  if (!isOnboardingV2Enabled()) redirect('/onboarding/desire')

  const user = await getCurrentUser()
  if (!user || user.is_anonymous) redirect('/onboarding/join')
  await redirectIfNotCandidate(user.id, user.email)

  const profile = await getOrCreateCandidateProfile(user.id)
  if (profile.assessmentComplete && profile.introCommittedAt) redirect('/dashboard')

  const { tracking } = await searchParams
  const summary = await getScanSummary(profile.id)
  const answered = profile.desireComplete

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.firstName ? `Welcome, ${profile.firstName}.` : 'Welcome.'}
        </h1>
        <p className="text-muted-foreground">
          {summary.state === 'not_connected'
            ? 'One quick question, and then we’ll show you how NextChapter works.'
            : 'We’re reading your search so far. While we do, one quick question.'}
        </p>
      </div>

      <ScanReveal initial={summary} tracking={trackingOutcome(tracking)} />

      {answered ? (
        <div className="space-y-2">
          <Button nativeButton={false} render={<Link href="/onboarding/welcome" />}>
            See how NextChapter works
          </Button>
          <p className="text-sm text-muted-foreground">Anything still being read carries on in the background.</p>
        </div>
      ) : (
        <section aria-labelledby="situation-heading" className="space-y-4">
          <h2 id="situation-heading" className="text-base font-semibold">
            Which of these sounds like you?
          </h2>
          <SituationForm action={submitRevealSituation} submitLabel="Save my answer" />
        </section>
      )}
    </div>
  )
}
