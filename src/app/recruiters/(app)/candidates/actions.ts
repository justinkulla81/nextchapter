'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { createPreConfirmedInviteUser } from '@/lib/invite/invite-and-preconfirm'
import { sendRecruiterCandidateInviteEmail } from '@/lib/email/send-recruiter-candidate-invite'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { createConsentedIntroductionIfMissing } from '@/lib/recruiter/introductions'

export type AddSourcedCandidateState = { error?: string; added?: boolean } | undefined

async function requireRecruiter() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.recruiter.findUnique({ where: { userId: user.id } })
}

export async function addSourcedCandidate(
  _prevState: AddSourcedCandidateState,
  formData: FormData
): Promise<AddSourcedCandidateState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const name = (formData.get('name') as string | null)?.trim()
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const notes = (formData.get('notes') as string | null)?.trim() || null
  if (!name) return { error: 'Enter their name.' }
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }

  const existing = await prisma.sourcedCandidate.findUnique({
    where: { recruiterId_email: { recruiterId: recruiter.id, email } },
  })
  if (existing) return { error: 'You already have this person in your candidate book.' }

  const sourced = await prisma.sourcedCandidate.create({
    data: { recruiterId: recruiter.id, name, email, notes },
  })

  captureServerEvent(recruiter.id, 'sourced_candidate_added', { recruiterId: recruiter.id, sourcedCandidateId: sourced.id })

  return { added: true }
}

export type InviteSourcedCandidateState = { error?: string; sent?: boolean } | undefined

export async function inviteSourcedCandidate(sourcedCandidateId: string): Promise<InviteSourcedCandidateState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const sourced = await prisma.sourcedCandidate.findUnique({ where: { id: sourcedCandidateId } })
  if (!sourced || sourced.recruiterId !== recruiter.id) return { error: 'Candidate not found.' }
  if (sourced.status === 'SIGNED_UP') return { error: 'This person has already joined NextChapter.' }

  // A person can already have a NextChapter account through a totally
  // unrelated path (organic signup, another coach/recruiter) — surface that
  // rather than silently failing, and don't try to invite them again.
  const existing = await findExistingRegisteredAccount(sourced.email, '')
  if (existing) {
    await prisma.sourcedCandidate.update({
      where: { id: sourced.id },
      data: { status: 'ALREADY_HAD_ACCOUNT' },
    })
    return { error: 'This person already has a NextChapter account.' }
  }

  const isFirstSend = sourced.status === 'ADDED'
  const inviteToken = sourced.inviteToken ?? crypto.randomUUID()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { actionLink, error: inviteError } = await createPreConfirmedInviteUser(
    sourced.email,
    `${appUrl}/auth/callback?next=recruiter-source&inviteToken=${inviteToken}`,
    { isFirstSend }
  )
  if (inviteError || !actionLink) {
    return { error: inviteError ?? 'Something went wrong sending the invite. Please try again.' }
  }

  await sendRecruiterCandidateInviteEmail(sourced.email, recruiter.fullName, recruiter.firmName, actionLink)

  await prisma.sourcedCandidate.update({
    where: { id: sourced.id },
    data: { status: 'INVITED', inviteToken, invitedAt: new Date() },
  })

  captureServerEvent(recruiter.id, 'recruiter_candidate_invite_sent', {
    recruiterId: recruiter.id,
    sourcedCandidateId: sourced.id,
  })

  return { sent: true }
}

// Called from CallbackHandler once the admin-generated magic link has
// established a session — sets sourcingRecruiterId on the new
// CandidateProfile (write-once, same invariant as coachId) and stamps the
// SourcedCandidate row as signed up. Non-redirecting — CallbackHandler
// decides what to do next (hands off to SecureAccountForm so they set a
// real password before landing in onboarding, same as the coach-invite
// flow). Per the "becomes a normal candidate" decision, this candidate gets
// no special treatment beyond that recorded relationship — full onboarding,
// general searchable pool, same as any organic signup.
export async function finishAcceptingRecruiterSource(inviteToken: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be logged in to accept this invite.' }

  const sourced = await prisma.sourcedCandidate.findUnique({ where: { inviteToken } })
  if (!sourced) return { error: 'This invite link is not valid.' }
  if (sourced.status === 'SIGNED_UP') return { error: 'This invite has already been accepted.' }
  if (user.email.toLowerCase() !== sourced.email.toLowerCase()) {
    return { error: `This invite was sent to ${sourced.email}. Log in with that email to accept it.` }
  }

  const nowRegistered = await findExistingRegisteredAccount(user.email, '')
  if (nowRegistered) {
    return { error: 'This email already has a NextChapter account. Log in with it instead.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id, { sourcingRecruiterId: sourced.recruiterId })
  await prisma.sourcedCandidate.update({
    where: { id: sourced.id },
    data: { status: 'SIGNED_UP', candidateId: profile.id },
  })

  // Signing up through this recruiter's own invite is real, direct
  // engagement — the one relationship this phase treats as automatically
  // CONSENTED without a separate request/approve step (see
  // src/lib/recruiter/introductions.ts and the RECRUITER_SOURCED backfill
  // path in scripts/backfill-recruiter-introductions.ts, which this mirrors
  // going forward).
  await createConsentedIntroductionIfMissing(
    sourced.recruiterId,
    profile.id,
    'RECRUITER_SOURCED',
    `recruiter:${sourced.recruiterId}`,
    'Candidate signed up through this recruiter\'s own sourcing invite.'
  )

  captureServerEvent(profile.id, 'recruiter_candidate_invite_accepted', {
    recruiterId: sourced.recruiterId,
    sourcedCandidateId: sourced.id,
  })

  return {}
}

// Resume access is only ever offered once a SourcedCandidate has actually
// signed up (candidateId set) — never for a merely-ADDED/INVITED lead who
// hasn't created a real account. Mirrors the signed-URL pattern in
// src/app/dashboard/resume/actions.ts, scoped to the recruiter relationship
// instead of self-ownership.
export async function getSourcedCandidateResumeSignedUrl(sourcedCandidateId: string): Promise<string | null> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return null

  const sourced = await prisma.sourcedCandidate.findFirst({
    where: { id: sourcedCandidateId, recruiterId: recruiter.id },
  })
  if (!sourced || !sourced.candidateId) return null

  const resume = await prisma.resume.findFirst({
    where: { candidateId: sourced.candidateId },
    orderBy: { uploadedAt: 'desc' },
  })
  if (!resume) return null

  const admin = createAdminClient()
  const { data } = await admin.storage.from('resumes').createSignedUrl(resume.filePath, 60 * 10)
  return data?.signedUrl ?? null
}

export type CommentaryFormState = { error?: string; saved?: boolean } | undefined

export async function updateResumeCommentary(
  sourcedCandidateId: string,
  _prevState: CommentaryFormState,
  formData: FormData
): Promise<CommentaryFormState> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return { error: 'You need to be logged in to do this.' }

  const sourced = await prisma.sourcedCandidate.findFirst({
    where: { id: sourcedCandidateId, recruiterId: recruiter.id },
  })
  if (!sourced) return { error: 'Candidate not found.' }

  const resumeCommentary = (formData.get('resumeCommentary') as string | null)?.trim() || null

  await prisma.sourcedCandidate.update({
    where: { id: sourced.id },
    data: { resumeCommentary },
  })

  revalidatePath(`/recruiters/candidates/${sourced.id}`)
  return { saved: true }
}

export async function toggleInBook(sourcedCandidateId: string, current: boolean) {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  const sourced = await prisma.sourcedCandidate.findFirst({
    where: { id: sourcedCandidateId, recruiterId: recruiter.id },
  })
  if (!sourced) return

  await prisma.sourcedCandidate.update({
    where: { id: sourced.id },
    data: { inBook: !current },
  })

  captureServerEvent(recruiter.id, 'candidate_added_to_book', {
    sourcedCandidateId: sourced.id,
    inBook: !current,
  })

  revalidatePath(`/recruiters/candidates/${sourced.id}`)
  revalidatePath('/recruiters/candidates/book')
}
