'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { getOrCreateThread } from '@/lib/messaging/threads'
import { sendPortfolioAccessRequestEmail } from '@/lib/email/send-portfolio-access-request'
import { captureServerEvent } from '@/lib/posthog/server'
import { isCandidateConsentedForRecruiter, recordIntroductionEvent } from '@/lib/recruiter/introductions'

async function requireRecruiter() {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.recruiter.findUnique({ where: { userId: user.id } })
}

// Gate mirrors the candidate-detail page's own visibility check — an
// active CONSENTED introduction for this specific (recruiter, candidate)
// pair, not the old blanket recruiterDatabaseOptIn flag — plus not
// LOCKED/STEALTH. Never trust the caller's candidateId alone.
async function requireUnlockedCandidate(recruiterId: string, candidateId: string) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, firstName: true, privacyTier: true, userId: true },
  })
  if (!candidate || candidate.privacyTier === 'LOCKED' || candidate.privacyTier === 'STEALTH') return null
  if (!(await isCandidateConsentedForRecruiter(candidateId, recruiterId))) return null
  return candidate
}

export async function getPoolCandidateResumeSignedUrl(candidateId: string): Promise<string | null> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return null

  const candidate = await requireUnlockedCandidate(recruiter.id, candidateId)
  if (!candidate) return null

  const resume = await prisma.resume.findFirst({
    where: { candidateId },
    orderBy: { uploadedAt: 'desc' },
  })
  if (!resume) return null

  const admin = createAdminClient()
  const { data } = await admin.storage.from('resumes').createSignedUrl(resume.filePath, 60 * 10)

  captureServerEvent(recruiter.id, 'recruiter_pool_candidate_resume_viewed', { candidateId })
  await recordIntroductionEvent(recruiter.id, candidateId, 'RESUME_VIEWED', `recruiter:${recruiter.id}`)

  return data?.signedUrl ?? null
}

export async function requestPortfolioAccess(candidateId: string): Promise<void> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  const candidate = await requireUnlockedCandidate(recruiter.id, candidateId)
  if (!candidate) return

  const existing = await prisma.portfolioAccessRequest.findUnique({
    where: { candidateId_recruiterId: { candidateId, recruiterId: recruiter.id } },
  })
  if (existing && existing.status !== 'DECLINED') return

  await prisma.portfolioAccessRequest.upsert({
    where: { candidateId_recruiterId: { candidateId, recruiterId: recruiter.id } },
    update: { status: 'REQUESTED', requestedAt: new Date(), respondedAt: null },
    create: { candidateId, recruiterId: recruiter.id },
  })

  if (candidate.userId) {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(candidate.userId)
    const candidateEmail = data.user?.email
    if (candidateEmail) {
      await sendPortfolioAccessRequestEmail(candidateEmail, candidate.firstName, recruiter.fullName, recruiter.firmName)
    }
  }

  captureServerEvent(recruiter.id, 'portfolio_access_requested', { candidateId, recruiterId: recruiter.id })

  revalidatePath(`/recruiters/search/${candidateId}`)
}

export async function startConversationWithCandidate(candidateId: string): Promise<void> {
  const recruiter = await requireRecruiter()
  if (!recruiter) return

  const candidate = await requireUnlockedCandidate(recruiter.id, candidateId)
  if (!candidate) return

  const thread = await getOrCreateThread(candidateId, 'RECRUITER', recruiter.id)

  captureServerEvent(recruiter.id, 'recruiter_pool_candidate_conversation_started', { candidateId })
  await recordIntroductionEvent(recruiter.id, candidateId, 'MESSAGED', `recruiter:${recruiter.id}`)

  redirect(`/recruiters/messages/${thread.id}`)
}
