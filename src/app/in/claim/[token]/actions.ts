'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { appUrl } from '@/lib/email/send-intake'
import { saveIntakeConsent } from '@/lib/recruiter/intake/consent'

export type ClaimFormState = { error?: string; needsLogin?: string } | undefined

async function liveIntakeCandidate(token: string) {
  const candidate = await prisma.intakeCandidate.findUnique({
    where: { claimToken: token },
    include: { connections: { where: { disconnectedAt: null } } },
  })
  if (!candidate || (candidate.purgeAt && candidate.purgeAt < new Date())) return null
  return candidate
}

export async function linkIntakeCandidateToProfile(intakeCandidateId: string, profileId: string) {
  // One NextChapter account per intake identity, and vice versa.
  const other = await prisma.intakeCandidate.findUnique({ where: { candidateId: profileId } })
  if (other && other.id !== intakeCandidateId) return
  await prisma.intakeCandidate.update({
    where: { id: intakeCandidateId },
    data: { candidateId: profileId, claimedAt: new Date(), purgeAt: null },
  })
}

// Spec F2/claim: consent first, then an account. No account is ever created
// until the person clicks here.
export async function claimIntakeProfile(_prev: ClaimFormState, formData: FormData): Promise<ClaimFormState> {
  const token = String(formData.get('token') ?? '')
  const candidate = await liveIntakeCandidate(token)
  if (!candidate) return { error: 'This link has expired. Ask the firm to send your resume again.' }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  for (const connection of candidate.connections) {
    await saveIntakeConsent(connection.id, formData.getAll(`consent-${connection.id}`).map(String), ip)
  }

  // Already signed in as a candidate with this email: link and go.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.email && user.email.toLowerCase() === candidate.email) {
    const profile = await getOrCreateCandidateProfile(user.id)
    await linkIntakeCandidateToProfile(candidate.id, profile.id)
    captureServerEvent(profile.id, 'talent_profile_claimed', { intakeCandidateId: candidate.id, path: 'signed_in' })
    redirect('/dashboard/privacy#my-recruiters')
  }

  // Has an account under this email: log in, then come back here.
  const registered = await findExistingRegisteredAccount(candidate.email, '')
  if (registered) {
    return { needsLogin: `/auth/login?next=${encodeURIComponent(`/in/claim/${token}`)}` }
  }

  const redirectTo = `${appUrl()}/auth/callback?next=talent-claim&inviteToken=${token}`
  let invite = await createPreConfirmedInviteUser(candidate.email, redirectTo, { isFirstSend: true })
  // An auth user can already exist without a finished profile (an earlier
  // claim click, an abandoned signup): mint a fresh link for it instead.
  if (invite.error) invite = await createPreConfirmedInviteUser(candidate.email, redirectTo, { isFirstSend: false })
  if (invite.error || !invite.actionLink) return { error: invite.error ?? 'Something went wrong. Please try again.' }

  captureServerEvent(candidate.id, 'talent_claim_started', { intakeCandidateId: candidate.id, connectionCount: candidate.connections.length })
  redirect(invite.actionLink)
}

// Called from CallbackHandler (next=talent-claim) once the magic link has
// established a candidate session.
export async function finishTalentClaim(token: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'You need to be signed in to open this profile.' }

  const candidate = await liveIntakeCandidate(token)
  if (!candidate) return { error: 'This link has expired.' }
  if (user.email.toLowerCase() !== candidate.email) {
    return { error: `This profile belongs to ${candidate.email}. Sign in with that email to open it.` }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await linkIntakeCandidateToProfile(candidate.id, profile.id)
  captureServerEvent(profile.id, 'talent_profile_claimed', { intakeCandidateId: candidate.id, path: 'new_account' })
  return {}
}
