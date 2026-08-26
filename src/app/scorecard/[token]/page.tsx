import { getPanelistByToken } from '@/lib/talent/scorecards'
import { ScorecardSubmitForm } from '@/components/talent/ScorecardSubmitForm'

// Relocated from src/app/hiring/scorecard/[token]/page.tsx to this
// portal-neutral top-level route as part of the /hiring -> /talent
// consolidation — mirrors src/app/ref/[token]'s existing convention for
// this exact class of route: a public, unguessable-token page a panelist
// uses to submit their scorecard without a NextChapter account.
export default async function ScorecardTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const panelist = await getPanelistByToken(token)

  if (!panelist) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Double check the link you were sent, or ask whoever set up the panel to resend it.
        </p>
      </div>
    )
  }

  const candidateName =
    [panelist.panel.submission.candidate.firstName, panelist.panel.submission.candidate.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'this candidate'

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">Interview scorecard for {candidateName}</h1>
        <p className="text-muted-foreground">
          {panelist.panel.submission.roleTitle} at {panelist.panel.submission.companyName}
        </p>
      </div>
      {panelist.scorecard?.submittedAt ? (
        <p className="text-sm text-muted-foreground">You&apos;ve already submitted this scorecard — thank you.</p>
      ) : (
        <ScorecardSubmitForm token={token} assignedCompetency={panelist.assignedCompetency} />
      )}
    </div>
  )
}
