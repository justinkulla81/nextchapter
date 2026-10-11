import 'server-only'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { captureServerEvent } from '@/lib/posthog/server'
import { Resend } from 'resend'
import type { InstitutionUserRole } from '@prisma/client'
import { ROLE_LABEL } from '@/lib/institution/permissions'

function resendClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// NextChapter invites a college's staff (there is no self-serve sign-up for this portal:
// a college is onboarded, then its people are invited). Re-sending an invite to someone
// who has not accepted yet reuses their row and token.
export async function inviteInstitutionUser(input: {
  institutionSlug: string
  email: string
  role: InstitutionUserRole
  fullName?: string | null
}): Promise<{ error?: string; acceptUrl?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@')) return { error: 'Enter a valid email address.' }

  const institution = await prisma.institution.findUnique({
    where: { slug: input.institutionSlug },
    select: { id: true, name: true },
  })
  if (!institution) return { error: `No college with the slug "${input.institutionSlug}".` }

  const existing = await prisma.institutionUser.findUnique({
    where: { institutionId_invitedEmail_role: { institutionId: institution.id, invitedEmail: email, role: input.role } },
  })
  if (existing?.acceptedAt && !existing.revokedAt) return { error: 'This person already has this role.' }

  const row =
    existing ??
    (await prisma.institutionUser.create({
      data: { institutionId: institution.id, invitedEmail: email, role: input.role, fullName: input.fullName ?? null },
    }))

  const { actionLink, error } = await createPreConfirmedInviteUser(
    email,
    `${appUrl()}/auth/callback?next=institution-invite&inviteToken=${row.inviteToken}`,
    { isFirstSend: !existing }
  )
  if (error || !actionLink) {
    if (!existing) await prisma.institutionUser.delete({ where: { id: row.id } })
    return { error: error ?? 'Something went wrong sending the invite.' }
  }

  const resend = resendClient()
  if (resend) {
    await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: email,
      subject: `You're invited to ${institution.name}'s NextChapter workspace`,
      html: `<p>You have been invited to ${institution.name}'s NextChapter workspace as ${ROLE_LABEL[input.role]}.</p><p><a href="${actionLink}">Accept the invitation</a></p>`,
    })
  }
  return { acceptUrl: actionLink }
}

// Called from CallbackHandler once the magic link has made a session.
export async function finishAcceptingInstitutionInvite(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient('institution')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const invite = await prisma.institutionUser.findUnique({ where: { inviteToken } })
  if (!invite || invite.revokedAt) return { error: 'This invite link is not valid.' }
  if (invite.acceptedAt) return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    return { error: `This invite was sent to ${invite.invitedEmail}. Log in with that email to accept it.` }
  }

  await prisma.institutionUser.update({ where: { id: invite.id }, data: { userId: user.id, acceptedAt: new Date() } })
  captureServerEvent(user.id, 'institution_invite_accepted', { institutionId: invite.institutionId, role: invite.role })
  return {}
}
