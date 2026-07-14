'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { analyzeJobFit } from '@/lib/jobs/analyze-job-fit'
import { generateInterviewPrep } from '@/lib/jobs/generate-interview-prep'
import { generateNegotiationAdvice } from '@/lib/jobs/generate-negotiation-advice'
import { recalculateScore } from '@/lib/scoring/recalculate'

export type FormState = { error?: string } | undefined

// Once a posting has landed an interview or offer it's a "won" historical
// record and no longer occupies one of the active fit-check slots — a real
// job search involves applying to far more than 5 jobs over time.
const MAX_ACTIVE_FIT_CHECK_SLOTS = 5

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
  if (!jobPosting || jobPosting.interviewLandedAt) return

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
