import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getTalentContext } from '@/lib/recruiter/intake/access'
import { SubmitButton } from '@/components/ui/submit-button'
import { acceptFirmInvite } from '../../actions'

export const metadata: Metadata = { title: 'Join a firm', robots: { index: false, follow: false } }

const ROLE_LABEL = { ADMIN: 'an admin', RECRUITER: 'a recruiter', COORDINATOR: 'a coordinator' } as const

export default async function JoinFirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ctx = await getTalentContext()
  const invite = await prisma.recruiterFirmInvite.findUnique({
    where: { token },
    include: { firm: { select: { name: true } } },
  })
  const inviter = invite ? await prisma.recruiter.findUnique({ where: { id: invite.invitedById }, select: { fullName: true } }) : null

  const forMe = invite && !invite.acceptedAt && invite.email.toLowerCase() === ctx.recruiter.workEmail.toLowerCase()

  return (
    <div className="mx-auto max-w-lg space-y-4 py-12">
      {ctx.firm ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">You already belong to a firm</h1>
          <p className="text-muted-foreground">Leave {ctx.firm.name} before accepting another invitation.</p>
        </>
      ) : forMe ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Join {invite.firm.name}</h1>
          <p className="text-muted-foreground">
            {inviter?.fullName ?? 'A firm admin'} invited you to join {invite.firm.name} as {ROLE_LABEL[invite.role]}.
            Joining routes the resumes sent to your personal page through the firm, and its admins can see them.
          </p>
          <form action={async () => { 'use server'; await acceptFirmInvite(token) }}>
            <SubmitButton pendingLabel="Joining…">Accept and join {invite.firm.name}</SubmitButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This invitation isn&apos;t available</h1>
          <p className="text-muted-foreground">
            It may have been used already, or it was sent to a different address than the one you&apos;re logged in with.
          </p>
        </>
      )}
      <Link href="/recruiters/talent" className="text-sm font-medium text-primary underline underline-offset-4">Back to Talent</Link>
    </div>
  )
}
