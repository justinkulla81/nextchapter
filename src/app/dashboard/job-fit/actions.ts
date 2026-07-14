'use server'

import { revalidatePath } from 'next/cache'
import type { JobReactionType, NotInterestedReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { analyzeJobFit } from '@/lib/jobs/analyze-job-fit'
import { generateInterviewPrep } from '@/lib/jobs/generate-interview-prep'
import { generateNegotiationAdvice } from '@/lib/jobs/generate-negotiation-advice'
import { generateCoverLetter } from '@/lib/reports/cover-letter'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { surfaceNewJobs, generateReactionSummary } from '@/lib/network/job-discovery'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'

export type FormState = { error?: string } | undefined

export async function submitJobUrl(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const url = (formData.get('url') as string | null)?.trim()
  if (!url) {
    return { error: 'Please enter a job posting URL.' }
  }

  try {
    new URL(url)
  } catch {
    return { error: 'Please enter a valid URL.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  const existingCount = await prisma.jobPosting.count({
    where: { candidateId: profile.id, interviewLandedAt: null, offerReceivedAt: null },
  })
  if (existingCount >= MAX_ACTIVE_FIT_CHECK_SLOTS) {
    return { error: 'You can track up to 5 active job postings at a time — remove one to add another.' }
  }

  const jobPosting = await prisma.jobPosting.create({
    data: { candidateId: profile.id, url, fetchStatus: 'pending' },
  })

  // Pasted text arrives together with the URL when the client already knows
  // (via getBlockedJobHost) this site can't be auto-fetched — skips the
  // pointless fetch attempt entirely rather than making the candidate submit
  // once, watch it fail, then submit again.
  const pastedText = (formData.get('text') as string | null)?.trim()

  if (pastedText) {
    await prisma.jobPosting.update({
      where: { id: jobPosting.id },
      data: { fetchStatus: 'success', fetchError: null, extractedText: pastedText.slice(0, 8000) },
    })
    await analyzeJobFit(jobPosting.id, profile.id)
  } else {
    const result = await fetchJobPosting(url)

    await prisma.jobPosting.update({
      where: { id: jobPosting.id },
      data: { fetchStatus: result.status, fetchError: result.error, extractedText: result.text },
    })

    if (result.status === 'success') {
      await analyzeJobFit(jobPosting.id, profile.id)
    }
  }

  revalidatePath('/dashboard/job-fit')
}

export async function retryJobFetch(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting) return

  const result = await fetchJobPosting(jobPosting.url)

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { fetchStatus: result.status, fetchError: result.error, extractedText: result.text },
  })

  if (result.status === 'success') {
    await analyzeJobFit(jobPostingId, profile.id)
  }

  revalidatePath('/dashboard/job-fit')
}

// Fallback for sites whose bot-detection blocks fetchJobPosting outright
// (Indeed, LinkedIn, etc.) — the candidate pastes the posting text directly,
// so the analysis can proceed without ever needing to fetch the URL again.
export async function submitJobPostingText(jobPostingId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const text = (formData.get('text') as string | null)?.trim()
  if (!text) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { fetchStatus: 'success', fetchError: null, extractedText: text.slice(0, 8000) },
  })

  await analyzeJobFit(jobPostingId, profile.id)

  revalidatePath('/dashboard/job-fit')
}

export async function markApplied(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting || jobPosting.appliedAt) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { appliedAt: new Date() },
  })
  await recalculateScore(profile.id, 'job_applied')

  revalidatePath('/dashboard/job-fit')
}

export async function generateCoverLetterAction(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting) return

  await generateCoverLetter(jobPostingId, profile.id)

  revalidatePath('/dashboard/job-fit')
}

export async function markInterviewLanded(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting || jobPosting.interviewLandedAt || !jobPosting.appliedAt) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { interviewLandedAt: new Date() },
  })
  await recalculateScore(profile.id, 'interview_landed')
  await generateInterviewPrep(jobPostingId, profile.id)

  revalidatePath('/dashboard/job-fit')
}

export async function markOfferReceived(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting || jobPosting.offerReceivedAt) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { offerReceivedAt: new Date() },
  })
  await recalculateScore(profile.id, 'offer_received')
  await generateNegotiationAdvice(jobPostingId, profile.id)

  revalidatePath('/dashboard/job-fit')
}

export async function deleteJobPosting(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.jobPosting.deleteMany({
    where: { id: jobPostingId, candidateId: profile.id },
  })

  revalidatePath('/dashboard/job-fit')
}

// ── Surfaced jobs (merged in from the old standalone Job Discovery page) ──

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function refreshSurfacedJobs() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await surfaceNewJobs(profile.id)
  revalidatePath('/dashboard/job-fit')
}

export async function reactToSurfacedJob(
  jobId: string,
  reaction: JobReactionType,
  reason: NotInterestedReason | null
) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.surfacedJob.updateMany({
    where: { id: jobId, candidateId: profile.id },
    data: { reaction, reactionReason: reason, reactedAt: new Date() },
  })
  revalidatePath('/dashboard/job-fit')
}

export type SummaryFormState = { summary?: string; error?: string } | undefined

export async function getReactionSummaryAction(_prevState: SummaryFormState): Promise<SummaryFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const summary = await generateReactionSummary(profile.id)
  if (!summary) {
    return { error: 'React to a few more jobs first — I need at least 3 reactions to spot a real pattern.' }
  }
  return { summary }
}

// A candidate marking a surfaced job "Interested" wants to move on it —
// promote it into a full tracked JobPosting (real fetched text, fit score,
// cover letter, applied/interview/offer tracking) rather than maintaining a
// second, shallower "interested jobs" data model.
export async function createCoverLetterFromSurfacedJob(
  surfacedJobId: string,
  _prevState: FormState
): Promise<FormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const surfacedJob = await prisma.surfacedJob.findFirst({
    where: { id: surfacedJobId, candidateId: profile.id },
  })
  if (!surfacedJob) return { error: 'Could not find that job.' }

  const existingCount = await prisma.jobPosting.count({
    where: { candidateId: profile.id, interviewLandedAt: null, offerReceivedAt: null },
  })
  if (existingCount >= MAX_ACTIVE_FIT_CHECK_SLOTS) {
    return { error: 'You can track up to 5 active job postings at a time — remove one on Job Fit to add another.' }
  }

  const jobPosting = await prisma.jobPosting.create({
    data: { candidateId: profile.id, url: surfacedJob.url, fetchStatus: 'pending' },
  })

  const result = await fetchJobPosting(surfacedJob.url)
  const usedFallbackDescription = result.status !== 'success' && !!surfacedJob.description
  const text = result.status === 'success' ? result.text : surfacedJob.description
  const fetchStatus = result.status === 'success' || usedFallbackDescription ? 'success' : result.status

  await prisma.jobPosting.update({
    where: { id: jobPosting.id },
    data: { fetchStatus, fetchError: usedFallbackDescription ? null : result.error, extractedText: text },
  })

  if (text) {
    await analyzeJobFit(jobPosting.id, profile.id)
    await generateCoverLetter(jobPosting.id, profile.id)
  }

  await prisma.surfacedJob.delete({ where: { id: surfacedJobId } })

  revalidatePath('/dashboard/job-fit')
}
