import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// Prompt 65 section 6 — "after account creation, show 'You have a pending
// reference from [Manager name] — review it?'" This covers the case where
// the candidate already had (or made) an account before opening the invite
// email/clicking the claim link — matched purely on email, since that's
// the only thing the employer-submission ever collected about them.
export async function PendingEmployerReferenceBanner({ candidateEmail }: { candidateEmail: string | null }) {
  if (!candidateEmail) return null

  const submission = await prisma.employerReferenceSubmission.findFirst({
    where: { employeeEmail: candidateEmail, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  })
  if (!submission) return null

  return (
    <Link
      href={`/claim-reference/${submission.inviteToken}`}
      className="block rounded-lg border border-dashed border-orange/40 bg-orange/5 p-4 text-sm hover:border-orange/60"
    >
      <p className="font-medium text-orange">
        You have a pending reference from {submission.submitterName} — review it?
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {submission.submitterCompany} left this while it was fresh. Nothing&apos;s been shared yet —
        it&apos;s your call.
      </p>
    </Link>
  )
}
