import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { acceptEmployerReference, declineEmployerReference } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Prompt 65 section 6 — getDashboardData() both requires the visitor to be
// signed in (redirects to /auth/login otherwise) and gives us their real
// candidateId, so claiming always happens as a deliberate, authenticated
// action by the person the reference is actually about — never anonymously,
// never on someone else's behalf.
export default async function ClaimReferencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const profile = await getDashboardData()

  const submission = await prisma.employerReferenceSubmission.findUnique({ where: { inviteToken: token } })

  if (!submission) {
    return (
      <StatusMessage title="This link isn't valid">
        Double check the link in your email, or ask the person who sent it to resend it.
      </StatusMessage>
    )
  }

  if (submission.status === 'claimed') {
    return (
      <StatusMessage title="Already added">
        You&apos;ve already accepted this reference — you can find it with your other references.
      </StatusMessage>
    )
  }

  if (submission.status === 'declined') {
    return (
      <StatusMessage title="You declined this reference">
        If that was a mistake, ask {submission.submitterName} to send a new one.
      </StatusMessage>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          You have a pending reference from {submission.submitterName}
        </h1>
        <p className="text-muted-foreground">
          {submission.submitterName} ({submission.submitterTitle ? `${submission.submitterTitle}, ` : ''}
          {submission.submitterCompany}) left this for you. Nothing here has been shared with anyone —
          review it below and decide whether to accept it.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">What they said you&apos;re especially good at</p>
          <p className="mt-1 text-sm text-foreground">{submission.strengthSummary}</p>
        </div>
        {submission.superpowerText && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Your superpower, in their words</p>
            <p className="mt-1 text-sm text-foreground">{submission.superpowerText}</p>
          </div>
        )}
        {submission.definingStory && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">A story they shared</p>
            <p className="mt-1 text-sm text-foreground">{submission.definingStory}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Would they work with you again?</p>
          <p className="mt-1 text-sm text-foreground">
            {submission.wouldHireAgain ? 'Yes' : 'No'}
            {submission.wouldWorkWithAgainReason ? ` — ${submission.wouldWorkWithAgainReason}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={acceptEmployerReference.bind(null, submission.id, profile.id)}>
          <SubmitButton pendingLabel="Adding…">Accept this reference</SubmitButton>
        </form>
        <form action={declineEmployerReference.bind(null, submission.id, profile.id)}>
          <SubmitButton variant="outline" pendingLabel="Declining…">
            Decline
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}

function StatusMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  )
}
