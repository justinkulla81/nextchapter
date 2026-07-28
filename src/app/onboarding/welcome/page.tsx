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
        <CardContent className="space-y-3 pt-6 text-sm text-foreground">
          <p>
            Your Hireability Assessment set your baseline <strong>Market Reality Grade</strong> —
            how competitive you look to employers right now. You raise it every week through real
            action: a <strong>Search Sprint</strong> of outreach, applications, interview prep,
            and networking that you commit to before the week starts. Complete it and your grade
            moves, because you&apos;re proving you&apos;re doing the work.{' '}
            <strong>Learning</strong>, <strong>Working</strong>, and <strong>Networking</strong>{' '}
            raise it the same way, over time.
          </p>
          <p>
            Hold an A and you unlock the <strong>Certified Executive Dossier</strong>,{' '}
            <strong>executive recruiter visibility</strong>, and the private{' '}
            <strong>NC Job Board</strong> — plus a spot on that week&apos;s <strong>A-List</strong>.
          </p>
          <p>
            Honestly, the points aren&apos;t the point — they&apos;re just a proxy for doing what
            actually gets people hired. The more real work you put in, the better your odds. Let&apos;s
            get started.
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
