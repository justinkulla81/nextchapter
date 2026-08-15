import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { redirectIfNotCandidate } from '@/lib/auth/redirect-non-candidate'
import { SituationForm } from '@/components/onboarding/SituationForm'
import { JOB_STATUS_TO_SITUATION } from '@/lib/constants/onboarding'

export default async function SituationPickerPage() {
  const user = await getCurrentUser()

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

  // Deliberately NOT redirecting forward just because desireComplete is
  // already true — that would make this step unreachable via the browser
  // Back button or the stepper's own link once answered once, which is
  // exactly the "let me change my answer" bug this fixes. updateSituation's
  // own action already redirects on to /onboarding/resume after a (first or
  // changed) submit, so nothing forward-flow depends on this page
  // self-redirecting on load.
  const initialSituation = profile?.currentJobStatus
    ? (JOB_STATUS_TO_SITUATION[profile.currentJobStatus] ?? null)
    : null

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
