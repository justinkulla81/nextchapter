'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ApplicationChannel, JobReactionType, NotInterestedReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { analyzeJobFit } from '@/lib/jobs/analyze-job-fit'
import { generateInterviewPrep } from '@/lib/jobs/generate-interview-prep'
import { generateNegotiationAdvice } from '@/lib/jobs/generate-negotiation-advice'
import { generateCoverLetter } from '@/lib/reports/cover-letter'
import { surfaceNewJobs, generateReactionSummary } from '@/lib/network/job-discovery'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import { generateThankYouEmail } from '@/lib/interview-prep/generate-thank-you-email'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  applyInterviewLandedRewrite,
  applyOfferReceivedRewrite,
  applyInterviewPatternConfirmedRewrite,
} from '@/lib/scoring/rewrite-actions'

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

  captureServerEvent(profile.id, 'job_added', { jobId: jobPosting.id })

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

  revalidatePath('/dashboard/find-my-job')
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

  revalidatePath('/dashboard/find-my-job')
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

  revalidatePath('/dashboard/find-my-job')
}

export async function markApplied(jobPostingId: string, formData: FormData) {
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

  const channel = formData.get('channel') as ApplicationChannel | null

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { appliedAt: new Date(), channel: channel ?? null },
  })
  captureServerEvent(profile.id, 'application_logged', { jobId: jobPostingId, channel })

  revalidatePath('/dashboard/find-my-job')
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

  revalidatePath('/dashboard/find-my-job')
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
  await applyInterviewLandedRewrite(profile.id)
  await applyInterviewPatternConfirmedRewrite(profile.id)
  await generateInterviewPrep(jobPostingId, profile.id)

  captureServerEvent(profile.id, 'interview_landed', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
}

// Pre-loads this job's posting text into the candidate's single shared
// activeJobDescription (the same field Interview Prep's tabs already read
// from) so prep is grounded in this specific role, then sends them there.
export async function prepForPhoneScreen(jobPostingId: string) {
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

  if (jobPosting.extractedText) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { activeJobDescription: jobPosting.extractedText },
    })
  }

  captureServerEvent(profile.id, 'interview_prep_started', { jobId: jobPostingId, mode: 'phone_screen' })

  redirect('/dashboard/interview-prep')
}

export async function markInterviewComplete(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting || jobPosting.interviewCompleteAt || !jobPosting.interviewLandedAt) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { interviewCompleteAt: new Date() },
  })

  captureServerEvent(profile.id, 'interview_completed', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
}

export async function requestJobThankYouNote(jobPostingId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const whatCameUp = (formData.get('whatCameUp') as string | null)?.trim()
  if (!whatCameUp || whatCameUp.length < 10) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting) return

  let companyName = 'the company'
  try {
    companyName = new URL(jobPosting.url).hostname.replace(/^www\./, '')
  } catch {
    // keep fallback
  }

  const note = await generateThankYouEmail({
    companyName,
    roleTitle: 'the role',
    discussionPoints: whatCameUp,
    tone: 'professional',
    jobDescription: jobPosting.extractedText,
  })

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: {
      thankYouNote: note,
      thankYouError: note ? null : "Couldn't generate a note just now — try again in a moment.",
    },
  })

  if (note) captureServerEvent(profile.id, 'thank_you_note_generated', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
}

export async function markJobThankYouSent(jobPostingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.jobPosting.updateMany({
    where: { id: jobPostingId, candidateId: profile.id },
    data: { thankYouSentAt: new Date() },
  })

  captureServerEvent(profile.id, 'thank_you_sent', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
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
  await applyOfferReceivedRewrite(profile.id)
  await generateNegotiationAdvice(jobPostingId, profile.id)

  captureServerEvent(profile.id, 'offer_received', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
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

  captureServerEvent(profile.id, 'job_posting_deleted', { jobId: jobPostingId })

  revalidatePath('/dashboard/find-my-job')
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
  revalidatePath('/dashboard/find-my-job')
}

// Fired from a plain onClick on the SurfacedJob/DiscoverJobCard anchors —
// never blocks or preventDefaults the navigation, just logs it. Denormalized
// into JobClickEvent (not just the PostHog event) so admin can group by
// company/title with a real Prisma groupBy — see the schema comment.
export async function recordJobClick(input: {
  source: 'surfaced' | 'job_board'
  sourceId: string
  jobTitle: string
  companyName: string | null
  location: string | null
  url: string
  fitBucket: string | null
}) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await prisma.jobClickEvent.create({
    data: {
      candidateId: profile.id,
      source: input.source,
      sourceId: input.sourceId,
      jobTitle: input.jobTitle,
      companyName: input.companyName,
      location: input.location,
      url: input.url,
      fitBucket: input.fitBucket,
    },
  })
  captureServerEvent(profile.id, 'job_link_clicked', {
    source: input.source,
    sourceId: input.sourceId,
    companyName: input.companyName,
  })
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
  captureServerEvent(profile.id, 'job_rated', { jobId, source: 'suggested', reaction })
  revalidatePath('/dashboard/find-my-job')
}

export type SummaryFormState = { summary?: string; error?: string } | undefined

export async function getReactionSummaryAction(_prevState: SummaryFormState): Promise<SummaryFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const summary = await generateReactionSummary(profile.id)
  if (!summary) {
    return { error: 'React to a few more jobs first — I need at least 3 reactions to spot a real pattern.' }
  }
  captureServerEvent(profile.id, 'pattern_unlocked')
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

  revalidatePath('/dashboard/find-my-job')
}

export type PromoteFormState = { error?: string; jobPostingId?: string } | undefined

// A candidate wanting the full fit analysis on an NC Job Board listing
// (Discover section) pulls it into the same tracked-application pipeline
// every self-found job already uses — one fit engine, one funnel,
// regardless of source. Unlike createCoverLetterFromSurfacedJob above, this
// never deletes the source row: an ExclusiveJobPosting is a shared listing
// other candidates still need to see, not a per-candidate suggestion.
export async function promoteJobBoardListing(postingId: string, _prevState: PromoteFormState): Promise<PromoteFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const posting = await prisma.exclusiveJobPosting.findFirst({
    where: { id: postingId, status: 'approved', archivedAt: null },
  })
  if (!posting) return { error: 'Could not find that listing.' }

  // Dedup by URL against the candidate's own tracker — clicking "See full
  // fit" twice on the same listing (or having already found it themselves)
  // should reuse the existing tracked posting, not create a duplicate. No
  // such check exists elsewhere on JobPosting today; this is the first.
  const existing = await prisma.jobPosting.findFirst({
    where: { candidateId: profile.id, url: posting.url },
  })
  if (existing) {
    revalidatePath('/dashboard/find-my-job')
    return { jobPostingId: existing.id }
  }

  const existingCount = await prisma.jobPosting.count({
    where: { candidateId: profile.id, interviewLandedAt: null, offerReceivedAt: null },
  })
  if (existingCount >= MAX_ACTIVE_FIT_CHECK_SLOTS) {
    return { error: 'You can track up to 5 active job postings at a time — remove one to add another.' }
  }

  const jobPosting = await prisma.jobPosting.create({
    data: { candidateId: profile.id, url: posting.url, fetchStatus: 'pending' },
  })

  // The board listing often already carries a real description — prefer it
  // over a redundant fetch; only hit the URL directly when it doesn't.
  let text = posting.description
  let fetchStatus = 'success'
  let fetchError: string | null = null
  if (!text) {
    const result = await fetchJobPosting(posting.url)
    text = result.text
    fetchStatus = result.status
    fetchError = result.error
  }

  await prisma.jobPosting.update({
    where: { id: jobPosting.id },
    data: { fetchStatus, fetchError, extractedText: text },
  })

  if (text) {
    await analyzeJobFit(jobPosting.id, profile.id)
  }

  captureServerEvent(profile.id, 'job_board_listing_promoted', { postingId, jobPostingId: jobPosting.id })

  revalidatePath('/dashboard/find-my-job')
  return { jobPostingId: jobPosting.id }
}

// Confidential recruiter listings never reveal the company name outright —
// this is the "soft-reveal handshake" instead: it signals real interest
// (captured for the recruiter to follow up on) rather than exposing the
// client relationship to every candidate who's merely curious.
export async function requestJobBoardIntro(postingId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const posting = await prisma.exclusiveJobPosting.findFirst({
    where: { id: postingId, status: 'approved', archivedAt: null },
  })
  if (!posting) return

  // Previously this only fired the analytics event below — nothing was
  // persisted, so the request never actually reached anyone. Now it's a
  // real row the admin Requests inbox surfaces.
  await prisma.jobBoardIntroRequest.create({
    data: { candidateId: profile.id, postingId, contactEmail: posting.contactEmail },
  })

  captureServerEvent(profile.id, 'job_board_intro_requested', { postingId, contactEmail: posting.contactEmail })

  revalidatePath('/dashboard/find-my-job')
}

const HEAVY_USAGE = new Set(['daily', 'few_times_week'])
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const NETWORK_NUDGE_TITLE = 'Your network is your fastest path'

export type JobBoardUsageState = { nudge: { title: string; bullets: string[] } | null } | undefined

// Prompt 62 — reads the board-usage frequency selections, then decides
// whether to surface the "network beats aggregators" nudge. The nudge
// content is read live from the existing DashboardMessage rotation content
// (see scripts/seed-dashboard-messages.ts) rather than duplicated here, so
// there's one source of truth for that copy.
export async function updateJobBoardUsage(
  _prevState: JobBoardUsageState,
  formData: FormData
): Promise<JobBoardUsageState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { nudge: null }

  const profile = await getOrCreateCandidateProfile(user.id)

  const usage = {
    linkedin: (formData.get('linkedin') as string | null) || 'never',
    indeed: (formData.get('indeed') as string | null) || 'never',
    ziprecruiter: (formData.get('ziprecruiter') as string | null) || 'never',
    company_pages: (formData.get('company_pages') as string | null) || 'never',
  }

  const heavyAggregatorUse = HEAVY_USAGE.has(usage.linkedin) || HEAVY_USAGE.has(usage.indeed)
  const nudgeIsStale =
    !profile.jobBoardUsageNudgeShownAt ||
    Date.now() - profile.jobBoardUsageNudgeShownAt.getTime() > NUDGE_COOLDOWN_MS
  const showNudge = heavyAggregatorUse && nudgeIsStale

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      jobBoardUsage: usage,
      ...(showNudge ? { jobBoardUsageNudgeShownAt: new Date() } : {}),
    },
  })

  revalidatePath('/dashboard/find-my-job')

  if (!showNudge) return { nudge: null }

  const message = await prisma.dashboardMessage.findFirst({
    where: { title: NETWORK_NUDGE_TITLE, isActive: true },
  })
  if (!message) return { nudge: null }

  return { nudge: { title: message.title, bullets: message.bullets } }
}
