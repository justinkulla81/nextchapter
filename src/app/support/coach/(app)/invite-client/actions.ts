'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { sendCoachClientInviteEmail } from '@/lib/email/send-coach-client-invite'
import { captureServerEvent } from '@/lib/posthog/server'
import { coachSetSessions } from '@/lib/access/grants'
import { callbackOriginForAppPath } from '@/lib/portal-hosts'

export type CoachClientInviteState = { error?: string; sent?: boolean } | undefined

async function requireCoach() {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.coach.findUnique({ where: { userId: user.id } })
}

export async function sendCoachClientInvite(
  _prevState: CoachClientInviteState,
  formData: FormData
): Promise<CoachClientInviteState> {
  const coach = await requireCoach()
  if (!coach) return { error: 'You need to be logged in to do this.' }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const name = (formData.get('name') as string | null)?.trim() || null
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v === '' ? null : Number(v)
  }
  const sessions = num('sessions')
  const validDays = num('validDays')
  if (sessions !== null && !(Number.isInteger(sessions) && sessions >= 1 && sessions <= 100)) return { error: 'Sessions must be a whole number from 1 to 100, or blank.' }
  if (validDays !== null && !(Number.isInteger(validDays) && validDays >= 1 && validDays <= 730)) return { error: 'Days must be a whole number from 1 to 730, or blank for no end.' }

  return sendOrResendInvite(coach, email, name, { sessions, validDays })
}

// Reused by both the "invite a new client" form and the per-row "resend"
// button on the pending-invites list — same duplicate-guard and
// create-vs-reuse-user logic either way.
async function sendOrResendInvite(
  coach: { id: string; fullName: string; firmName: string | null },
  email: string,
  name: string | null,
  // undefined (a resend) keeps whatever the invite already has.
  paid?: { sessions: number | null; validDays: number | null }
): Promise<CoachClientInviteState> {
  // A different, already-registered candidate owns this email — never
  // silently reassign coachId onto their existing profile (see the
  // never-reassign invariant on CandidateProfile.coachId).
  const existing = await findExistingRegisteredAccount(email, '')
  if (existing) {
    return {
      error:
        'This person already has a NextChapter account. Make them an access code (Codes and sessions) and they can enter it on their Executive Coach page.',
    }
  }

  const priorInvite = await prisma.coachClientInvite.findUnique({
    where: { coachId_invitedEmail: { coachId: coach.id, invitedEmail: email } },
  })
  if (priorInvite?.acceptedAt) {
    return { error: 'This person has already accepted an invite from you.' }
  }

  const invite = priorInvite
    ? paid
      ? await prisma.coachClientInvite.update({ where: { id: priorInvite.id }, data: { sessions: paid.sessions, validDays: paid.validDays } })
      : priorInvite
    : await prisma.coachClientInvite.create({
        data: { coachId: coach.id, invitedEmail: email, invitedName: name, sessions: paid?.sessions ?? null, validDays: paid?.validDays ?? null },
      })


  const { actionLink, error: inviteError } = await createPreConfirmedInviteUser(
    email,
    `${callbackOriginForAppPath('/dashboard')}/auth/callback?next=coach-invite&inviteToken=${invite.inviteToken}`,
    { isFirstSend: !priorInvite }
  )
  if (inviteError || !actionLink) {
    if (!priorInvite) await prisma.coachClientInvite.delete({ where: { id: invite.id } })
    return { error: inviteError ?? 'Something went wrong sending the invite. Please try again.' }
  }

  await sendCoachClientInviteEmail(email, coach.fullName, coach.firmName, actionLink)

  captureServerEvent(coach.id, 'coach_client_invite_sent', { coachId: coach.id, inviteId: invite.id, sessions: invite.sessions, validDays: invite.validDays })

  return { sent: true }
}

export type ResendState = { error?: string; sent?: boolean } | undefined

export async function resendCoachClientInvite(inviteId: string): Promise<ResendState> {
  const coach = await requireCoach()
  if (!coach) return { error: 'You need to be logged in to do this.' }

  const invite = await prisma.coachClientInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.coachId !== coach.id) return { error: 'Invite not found.' }
  if (invite.acceptedAt) return { error: 'This invite has already been accepted.' }

  return sendOrResendInvite(coach, invite.invitedEmail, invite.invitedName)
}

// Called from CallbackHandler once the admin-generated magic link has
// established a session — sets coachId on the new CandidateProfile (the
// one and only write site, via getOrCreateCandidateProfile, same
// never-reassign invariant as the cookie-based invite link) and stamps the
// invite as accepted. Non-redirecting — CallbackHandler decides what to do
// next (hands off to SecureAccountForm so they set a real password before
// landing in onboarding).
export async function finishAcceptingCoachInvite(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient('coach')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const invite = await prisma.coachClientInvite.findUnique({ where: { inviteToken } })
  if (!invite) return { error: 'This invite link is not valid.' }
  if (invite.acceptedAt) return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    return { error: `This invite was sent to ${invite.invitedEmail}. Log in with that email to accept it.` }
  }

  // Defensive re-check for the race where someone else registered this
  // email between the invite being sent and it being accepted — never
  // touch coachId in that case.
  const nowRegistered = await findExistingRegisteredAccount(user.email, '')
  if (nowRegistered) {
    return { error: 'This email already has a NextChapter account. Log in with it instead.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id, { coachId: invite.coachId })
  await prisma.coachClientInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date(), candidateId: profile.id },
  })

  // Sessions the coach set on the invite become the client's sessions with them.
  if (invite.sessions) await coachSetSessions(invite.coachId, profile.id, invite.sessions, invite.validDays, `invite:${invite.id}`).catch(() => null)

  captureServerEvent(profile.id, 'coach_client_invite_accepted', { coachId: invite.coachId, inviteId: invite.id, sessions: invite.sessions })

  return {}
}
