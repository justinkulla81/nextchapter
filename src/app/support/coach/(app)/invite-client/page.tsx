import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { InviteClientForm } from '@/components/coach/InviteClientForm'
import { ResendInviteButton } from '@/components/coach/ResendInviteButton'

const STATUS_LABEL = {
  accepted: 'Joined',
  pending: 'Invite pending',
  registeredElsewhere: 'Already has an account',
} as const

export default async function InviteClientByEmailPage() {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/support/coach/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/support/coach/signup')

  const invites = await prisma.coachClientInvite.findMany({
    where: { coachId: coach.id },
    orderBy: { invitedAt: 'desc' },
  })

  // A pending invite's target can register through a completely separate
  // path after the invite was sent (e.g. organic signup) — that invite can
  // never be accepted anymore, so surface it rather than leaving it stuck
  // showing "Invite pending" forever.
  const registeredElsewhere = new Set<string>()
  await Promise.all(
    invites
      .filter((invite) => !invite.acceptedAt)
      .map(async (invite) => {
        const match = await findExistingRegisteredAccount(invite.invitedEmail, '')
        if (match) registeredElsewhere.add(invite.id)
      })
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div>
        <Link href="/support/coach" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Invite a client</h1>
        <p className="mt-1 text-muted-foreground">
          Invite someone directly by email — they&apos;ll be able to set a password right away and start
          working with you, no separate confirmation step needed.
        </p>
      </div>

      <InviteClientForm />

      <div className="divide-y divide-border rounded-lg border border-border">
        {invites.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No invites sent yet.</p>
        ) : (
          invites.map((invite) => {
            const status = invite.acceptedAt
              ? 'accepted'
              : registeredElsewhere.has(invite.id)
                ? 'registeredElsewhere'
                : 'pending'
            return (
              <div key={invite.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-foreground">{invite.invitedName || invite.invitedEmail}</p>
                  {invite.invitedName && <p className="text-sm text-muted-foreground">{invite.invitedEmail}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</span>
                  {status === 'pending' && <ResendInviteButton inviteId={invite.id} />}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
