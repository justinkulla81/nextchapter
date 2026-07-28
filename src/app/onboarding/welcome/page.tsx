import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { submitIntroCommitment } from '@/app/onboarding/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
          Before you land on your dashboard, here&apos;s exactly how this works — what you&apos;ll
          get, and what it expects from you in return.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            How NextChapter works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>
            Every week you run a <strong>Search Sprint</strong>: a short list of real actions —
            outreach, applications, interview prep, networking — that you commit to before the
            week starts. Each action is worth points. Complete them and you build your{' '}
            <strong>Weekly Search Score</strong>, which sets your <strong>Search Action Grade</strong>{' '}
            (A–F) — a measure of how hard you&apos;re actually working the process, this week,
            not last quarter.
          </p>
          <p>
            Separately, your <strong>Market Reality Grade</strong>{' '}
            reflects how competitive
            you&apos;ll look to employers right now — your resume, experience, and references.
            You can&apos;t always change that overnight. You can always change your Search Action
            Grade, starting this week.
          </p>
          <p>
            Some actions on your Sprint — confirming your profile, taking the How I Work Best
            assessment, answering a few background questions — check themselves off automatically
            the moment you actually do the real thing. Everything else, you mark done yourself. Be
            honest with it: the whole point of tracking this is to see the truth about your own
            effort, not to look busy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            What you&apos;re working toward
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>
            An A Search Action Grade isn&apos;t just a badge. It&apos;s the gate on the things
            that actually move a search forward:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Certified Executive Dossier</strong> — the polished, evidence-backed profile
              we hand to hiring managers and recruiters on your behalf, built from your references,
              work samples, and how you actually work.
            </li>
            <li>
              <strong>Executive recruiter visibility</strong>{' '}
              — once you&apos;re A-graded and opt in, your profile becomes visible to the real
              recruiters and employers searching our candidate database for people like you.
            </li>
            <li>
              <strong>NC Job Board</strong> — a private, admin-curated set of real, exclusive
              roles only open to A-graded, opted-in candidates. Not scraped listings — jobs we went
              and got.
            </li>
          </ul>
          <p>
            Every week you hold an A also earns you a spot on that week&apos;s{' '}
            <strong>A-List</strong> — called out by name to the rest of the community as one of the
            people putting in real, visible work this week.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            What this expects from you
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>
            NextChapter can make your plan clear, remove the busywork, and hold you accountable
            every day. It can&apos;t do the search for you.
          </p>
          <p>
            The people who get real results here are the ones who actually want it — who show up,
            do the unglamorous work of outreach and follow-up, and treat their own effort as
            something worth being honest about. That&apos;s the whole premise of the grade: not
            &ldquo;are you talented,&rdquo; but &ldquo;can a hiring manager trust that you&apos;ll
            put in the work to earn this?&rdquo; The best way to convince them is to actually be
            that person, starting now.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-lg border-2 border-success bg-success/5 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Commit below and we&apos;ll add {INTRO_WELCOME_BONUS_POINTS} points to your first
          Search Sprint — your first sign that this is real, not just a read.
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
