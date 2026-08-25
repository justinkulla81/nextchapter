import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AcceptSeatForm } from '@/components/talent/AcceptSeatForm'
import { AcceptSeatButton } from '@/components/talent/AcceptSeatButton'

export default async function AcceptSeatInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const seat = await prisma.employerSeat.findUnique({
    where: { inviteToken: token },
    include: { employer: { select: { companyName: true } } },
  })

  if (!seat) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  if (seat.acceptedAt) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This invite has already been accepted</h1>
        <p className="mt-2 text-muted-foreground">Log in to your account to get to the team&apos;s roles.</p>
      </div>
    )
  }

  const supabase = await createClient('talent')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Employers</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Join {seat.employer.companyName} on NextChapter
        </h1>
        <p className="text-muted-foreground">
          You&apos;ll get access to the same roles, candidates, and hiring analytics.
        </p>
      </div>

      {user ? (
        user.email?.toLowerCase() === seat.invitedEmail.toLowerCase() ? (
          <AcceptSeatButton seatToken={token} />
        ) : (
          <p className="text-sm text-destructive">
            This invite was sent to {seat.invitedEmail}. You&apos;re logged in as {user.email} — log out and
            log back in with the invited email to accept.
          </p>
        )
      ) : (
        <div className="space-y-6">
          <AcceptSeatForm seatToken={token} invitedEmail={seat.invitedEmail} />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a
              href={`/talent/login?next=${encodeURIComponent(`/talent/seats/accept/${token}`)}`}
              className="underline underline-offset-4"
            >
              Log in
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
