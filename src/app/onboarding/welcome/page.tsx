import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { submitIntroCommitment } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardContent } from '@/components/ui/card'
import { INTRO_WELCOME_BONUS_POINTS } from '@/lib/weekly/sprint'

export default async function WelcomePage() {
  const profile = await getCandidateProfileForUser()

  // Only reachable once an account actually exists — getDashboardData and
  // the /onboarding router both send here right after registration, but a
  // direct hit before that (or a second visit after already committing)
  // should bounce to wherever the candidate actually belongs.
  if (!profile.registrationCompletedAt) redirect('/onboarding')
  if (profile.introCommittedAt) redirect('/dashboard')

  const name = profile.firstName ? `, ${profile.firstName}` : ''

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to NextChapter{name}.</h1>
        <p className="text-muted-foreground">
          NextChapter is a job transition platform. The quick version:
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6 text-sm text-foreground">
          <p>
            You already know what getting hired actually takes: outreach, applications, interview
            prep, networking — done consistently, not in bursts. NextChapter turns that into a{' '}
            <strong>Search Sprint</strong> you commit to before each week starts, and tracks your
            progress as your <strong>Current Market Reality</strong> — how competitive you look to
            employers right now.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your Hireability Assessment set your starting grade.</li>
            <li>Complete your weekly Search Sprint and your grade moves, because you&apos;re proving you&apos;re doing the work.</li>
            <li><strong>Learning</strong>, <strong>Working</strong>, and <strong>Networking</strong> raise it the same way, over time.</li>
          </ul>
          <p>Do the work, hold an A, and here&apos;s what you get:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The <strong>Certified Executive Dossier</strong>, handed to recruiters and hiring managers</li>
            <li><strong>Executive recruiter visibility</strong></li>
            <li>Access to the private <strong>NC Job Board</strong></li>
          </ul>
          <p className="text-muted-foreground">
            Honestly, the points aren&apos;t the point — they&apos;re just a proxy for doing what
            actually gets people hired. Let&apos;s get started.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-lg border-2 border-success bg-success/5 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Commit below and we&apos;ll queue up {INTRO_WELCOME_BONUS_POINTS} bonus points for your
          first Search Sprint — they land the moment you set it.
        </p>
        <form action={submitIntroCommitment} className="mt-4 flex justify-center">
          <SubmitButton size="lg" pendingLabel="Locking it in…">
            I&apos;m committed — take me to my dashboard
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
