import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { submitIntroCommitment } from '@/app/onboarding/actions'
import { PrimaryAction } from '@/components/onboarding/bundles/PrimaryAction'
import { SpinnerCursor } from '@/components/ui/spinner-cursor'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { progressOf } from '@/lib/onboarding/progress'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'
import { INTRO_WELCOME_BONUS_POINTS } from '@/lib/weekly/sprint'

export default async function WelcomePage() {
  const profile = await getCandidateProfileForUser()

  // Only reachable once an account actually exists — getDashboardProfile and
  // the /onboarding router both send here right after registration, but a
  // direct hit before that (or a second visit after already committing)
  // should bounce to wherever the candidate actually belongs.
  if (!profile.registrationCompletedAt) redirect('/onboarding')
  if (profile.introCommittedAt) redirect('/dashboard')
  // The short question bundles end with the Google reveal (optional, and skippable there), before this welcome.
  if (isGoogleConnectOn() && flowOfProfile(profile) === 'bundles' && !progressOf(profile.journeyDetails).googleRevealAt) redirect('/onboarding/google')

  const name = profile.firstName ? `, ${profile.firstName}` : ''

  // Same shape as the question screens: one serif headline, one line, the primary action right under it.
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">Welcome to NextChapter{name}.</h1>
        <p className="text-base text-muted-foreground">
          Each week you commit to a Search Sprint. Doing the work is what moves your grade.
        </p>
      </div>

      <form action={submitIntroCommitment} className="space-y-3">
        <SpinnerCursor />
        <PrimaryAction pendingLabel="Locking it in…">I&apos;m committed — take me to my dashboard</PrimaryAction>
        <p className="text-sm text-muted-foreground">
          Commit now and {INTRO_WELCOME_BONUS_POINTS} bonus points land with your first Search Sprint.
        </p>
      </form>
    </div>
  )
}
