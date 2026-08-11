'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ApplicationChannel, DeclineParty, JobReactionType, NotInterestedReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { fetchJobPosting } from '@/lib/jobs/fetch-job-posting'
import { analyzeJobFit } from '@/lib/jobs/analyze-job-fit'
import { generateInterviewPrep } from '@/lib/jobs/generate-interview-prep'
import { generateNegotiationAdvice } from '@/lib/jobs/generate-negotiation-advice'
import { evaluateCounterOffer, type CounterOfferEvaluation } from '@/lib/negotiation/evaluate-counter-offer'
import { generateCoverLetter } from '@/lib/reports/cover-letter'
import { surfaceNewJobs } from '@/lib/network/job-discovery'
import { MAX_ACTIVE_FIT_CHECK_SLOTS } from '@/lib/constants/job-milestones'
import { generateThankYouEmail } from '@/lib/interview-prep/generate-thank-you-email'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  applyInterviewLandedRewrite,
  applyOfferReceivedRewrite,
  applyInterviewPatternConfirmedRewrite,
} from '@/lib/scoring/rewrite-actions'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

export type FormState = { error?: string } | undefined

// Polled client-side by EmailSyncWatcher — the Gmail sync that populates the
// Application Tracker is backgrounded via after() (see find-my-job/page.tsx)
// so a just-applied email never shows up on the page load that triggered its
// own sync. This is how the client learns the background sync actually
// finished so it knows to refresh.
export async function getEmailSyncLastSyncAt(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getOrCreateCandidateProfile(user.id)
  const connection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
    select: { lastSyncAt: true },
  })
  return connection?.lastSyncAt?.toISOString() ?? null
}

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

// Same shape as submitJobUrl, but for the Interview Tracking section's
// "add a job link for this interview" quick-add — the posting is created
// already applied-and-interviewing rather than needing the normal
// applied -> "I got an interview" click sequence, since the candidate is
// telling us about an interview they already have, not a job they just
// found.
export async function addInterviewJob(_prevState: FormState, formData: FormData): Promise<FormState> {
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
    data: {
      candidateId: profile.id,
      url,
      fetchStatus: 'pending',
      appliedAt: new Date(),
      interviewLandedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'job_added', { jobId: jobPosting.id, viaInterviewTracking: true })

  // This posting is created already-applied (see appliedAt above) — same
  // real signal as markApplied, so it earns the same Search Action rather
  // than silently never crediting an application logged through this entry
  // point.
  const applyEffort = estimateActionEffort({ actionType: 'JOB_APPLICATION_SUBMITTED' })
  await autoCompleteEngagementAction(profile.id, {
    actionType: 'JOB_APPLICATION_SUBMITTED',
    text: 'Apply to a job',
    points: applyEffort.points,
    estimatedMinutes: applyEffort.minutes,
  })

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

  await applyInterviewLandedRewrite(profile.id)
  await applyInterviewPatternConfirmedRewrite(profile.id)
  await generateInterviewPrep(jobPosting.id, profile.id)

  captureServerEvent(profile.id, 'interview_landed', { jobId: jobPosting.id, source: 'interview_tracking_quick_add' })

  revalidatePath('/dashboard/find-my-job')
}

// The Interview Tracking section's "which job?" dropdown can't bind a
// server action to a jobPostingId chosen at submit time the way every
// other per-posting button here does (.bind(null, posting.id) needs the id
// up front) — this reads it from the submitted <select> instead and
// delegates to the exact same markInterviewLanded logic.
export async function markInterviewLandedFromForm(formData: FormData) {
  const jobPostingId = formData.get('jobPostingId') as string | null
  if (!jobPostingId) return
  await markInterviewLanded(jobPostingId)
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
  if (!jobPosting || !jobPosting.url) return

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

  // Real, verified signal — a specific tracked posting just moved to
  // Applied — so this earns the Search Action directly rather than relying
  // on a disconnected self-report click (same pattern as the negotiation
  // counter-offer practice below).
  const effort = estimateActionEffort({ actionType: 'JOB_APPLICATION_SUBMITTED' })
  await autoCompleteEngagementAction(profile.id, {
    actionType: 'JOB_APPLICATION_SUBMITTED',
    text: 'Apply to a job',
    points: effort.points,
    estimatedMinutes: effort.minutes,
  })

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

  let companyName = jobPosting.companyName ?? 'the company'
  if (!jobPosting.companyName && jobPosting.url) {
    try {
      companyName = new URL(jobPosting.url).hostname.replace(/^www\./, '')
    } catch {
      // keep fallback
    }
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

export async function markDeclined(jobPostingId: string, declinedBy: DeclineParty) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!jobPosting || jobPosting.declinedAt || jobPosting.offerReceivedAt) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { declinedAt: new Date(), declinedBy },
  })

  captureServerEvent(profile.id, 'application_declined', { jobId: jobPostingId, declinedBy })

  revalidatePath('/dashboard/find-my-job')
}

// Manually flags a contact as someone who can help with this specific
// application ("who can help me get this job") — separate from the
// automatic company-name backchannel match in src/lib/network/backchannel.ts,
// which is computed on the fly and never stored per-job.
export async function linkContactToJob(jobPostingId: string, contactId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const [jobPosting, contact] = await Promise.all([
    prisma.jobPosting.findFirst({ where: { id: jobPostingId, candidateId: profile.id } }),
    prisma.supportNetworkContact.findFirst({ where: { id: contactId, candidateId: profile.id } }),
  ])
  if (!jobPosting || !contact) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { helpfulContacts: { connect: { id: contactId } } },
  })
  revalidatePath('/dashboard/find-my-job')
}

export async function unlinkContactFromJob(jobPostingId: string, contactId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const jobPosting = await prisma.jobPosting.findFirst({ where: { id: jobPostingId, candidateId: profile.id } })
  if (!jobPosting) return

  await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { helpfulContacts: { disconnect: { id: contactId } } },
  })
  revalidatePath('/dashboard/find-my-job')
}

// Lets a candidate fill in the title/link on an application NextChapter
// only has a company name for (mainly EMAIL_DETECTED rows — a confirmation
// subject rarely names the role). Purely a private annotation on their own
// record: it never triggers fetchJobPosting/analyzeJobFit, so adding a
// link here doesn't start the LLM fit-check pipeline or share anything
// with anyone else.
export async function updateApplicationDetails(jobPostingId: string, formData: FormData) {
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

  const title = (formData.get('title') as string | null)?.trim() || null
  const rawUrl = (formData.get('url') as string | null)?.trim() || null
  let url = jobPosting.url
  if (rawUrl) {
    try {
      url = new URL(rawUrl).toString()
    } catch {
      // Leave the existing url alone rather than fail the whole save over
      // an unparseable link — title-only edits are the common case.
    }
  }

  await prisma.jobPosting.update({ where: { id: jobPostingId }, data: { title, url } })
  revalidatePath('/dashboard/find-my-job')
}

export async function updateResumeBookOptIn(optedIn: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { resumeBookOptIn: optedIn },
  })
  captureServerEvent(profile.id, 'resume_book_opt_in_updated', { optedIn })
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

  // Reacting Interested to a specific surfaced posting is a real, if small,
  // signal — earns the Search Action directly, same as the Applied signal
  // above, rather than a disconnected self-report click.
  if (reaction === 'INTERESTED') {
    const effort = estimateActionEffort({ actionType: 'JOB_INTERESTED_REACTION' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'JOB_INTERESTED_REACTION',
      text: 'Express interest in a job listing',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }

  revalidatePath('/dashboard/find-my-job')
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

// Prompt 78 — negotiation practice draft/feedback/redraft loop, same UI
// pattern as Interview Prep's PracticeTab. Ephemeral: like Interview Prep,
// the draft and feedback aren't persisted, only the fact that a real
// session happened.
export async function requestNegotiationPracticeFeedback(
  jobPostingId: string,
  draftText: string
): Promise<CounterOfferEvaluation | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!draftText.trim()) return null

  const profile = await getOrCreateCandidateProfile(user.id)
  const posting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, candidateId: profile.id },
  })
  if (!posting?.negotiationAdvice) return null

  const advice = posting.negotiationAdvice as unknown as {
    talkingPoints: string[]
    considerations: string[]
    scriptOpening: string
  }

  const evaluation = await evaluateCounterOffer(draftText, advice)
  if (!evaluation) return null

  // Completing a real practice session (not just viewing generated advice)
  // is what earns the Search Action — autoCompleteEngagementAction no-ops
  // if it's already been earned this week (e.g. via manual self-report on
  // this same page), so this never double-counts.
  const sprint = await getCurrentWeekSprint(profile.id)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'NEGOTIATION_ADVICE' })
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'NEGOTIATION_ADVICE',
      text: 'Practice your negotiation counter-ask',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }

  captureServerEvent(profile.id, 'negotiation_practice_completed', { jobPostingId })
  return evaluation
}

