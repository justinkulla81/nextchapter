import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { SituationForm } from '@/components/onboarding/SituationForm'
import { BundleShell } from '@/components/onboarding/bundles/BundleShell'
import { BundleForm } from '@/components/onboarding/bundles/BundleForm'
import { submitWhereYouAre } from '@/app/onboarding/bundle-actions'
import { JOURNEY_TO_SITUATION } from '@/lib/constants/onboarding'
import { effectiveJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { storedAnswers } from '@/lib/onboarding/answers'
import { usableAnswers } from '@/lib/onboarding/bundles'
import { entryFromGoalParam } from '@/lib/onboarding/resume-rule'
import { captureServerEvent } from '@/lib/posthog/server'
import { posthogCookieName, posthogDistinctId } from '@/lib/posthog/visitor-id'
import { LEAD_COOKIE, emailFromLeadCookie } from '@/lib/leads/lifecycle/prefill'

export default async function SituationPickerPage({ searchParams }: { searchParams: Promise<{ goal?: string; from?: string }> }) {
  // A Market Reality link (/onboarding/desire?goal=market-reality) makes the résumé step required later.
  const { goal, from } = await searchParams
  const entryGoal = entryFromGoalParam(goal) ? goal : undefined
  const user = await getCurrentUser()

  // Arrived from the /after-a-layoff form (its source rides on the link): recorded here, on the server, so it is not lost to the browser.
  // The visitor's PostHog id joins their earlier events; failing that, the email in the signed lead cookie.
  const arrivedFrom = /^after-a-layoff(:[a-z0-9_-]{1,60})?$/.exec(from ?? '')?.[0]
  if (arrivedFrom) {
    const jar = await cookies()
    const visitor = posthogDistinctId(jar.get(posthogCookieName())?.value) ?? emailFromLeadCookie(jar.get(LEAD_COOKIE)?.value)
    if (visitor) captureServerEvent(visitor, 'after_a_layoff_registration_arrived', { source: arrivedFrom, utmSource: arrivedFrom.split(':')[1] ?? null, signedIn: !!user })
  }

  // An admin, hiring manager, recruiter, or coach landing here (e.g. a
  // password-reset fallback redirect) should never silently get a stray
  // CandidateProfile created.
  if (user) {
    await redirectIfNotCandidate(user.id, user.email)
  }

  // No session yet at all — nothing to show a prior state for. This is now
  // the first onboarding step, so (unlike getCandidateProfileForUser, which
  // would redirect a session-less visitor right back here) we render the
  // form directly; its action (updateSituation) lazily starts an anonymous
  // session on submit.
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null

  if (profile?.registrationCompletedAt) {
    redirect('/dashboard')
  }

  const journey = profile ? effectiveJourney(profile) : null

  // The short question bundles (docs/personalization-audit/bundles.md O1), for members on that flow.
  // Everyone else gets the classic picker below, untouched.
  if (flowOfProfile(profile, user?.email) === 'bundles') {
    const initial = usableAnswers('where_you_are', { journey }, profile ? storedAnswers(profile) : {})
    return (
      <BundleShell id="where_you_are" title={profile?.firstName ? `Hi ${profile.firstName}, which of these sounds most like you?` : 'Which of these sounds most like you?'}>
        <BundleForm bundle="where_you_are" initial={initial} storedJourney={journey} payoffInput={{ storedStage: profile?.journeyStage ?? null }} action={submitWhereYouAre} hidden={entryGoal ? { entry: entryGoal } : undefined} autoSubmit={!!arrivedFrom && !profile?.desireComplete} />
      </BundleShell>
    )
  }

  // Deliberately NOT redirecting forward just because desireComplete is
  // already true — that would make this step unreachable via the browser
  // Back button or the stepper's own link once answered once, which is
  // exactly the "let me change my answer" bug this fixes. updateSituation's
  // own action already redirects on to /onboarding/resume after a (first or
  // changed) submit, so nothing forward-flow depends on this page
  // self-redirecting on load.
  const initialSituation = journey ? JOURNEY_TO_SITUATION[journey] : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.firstName ? `Hi ${profile.firstName}, which of these sounds like you?` : 'Which of these sounds like you?'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick the one that fits best — we&apos;ll tailor your Market Reality Assessment to your situation.
        </p>
      </div>
      <SituationForm initialSituation={initialSituation} />
    </div>
  )
}
