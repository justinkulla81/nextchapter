'use server'

import { revalidatePath } from 'next/cache'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { candidatePlusRequiredMessage } from '@/lib/jobs/candidate-plus-extras'
import { classifyWorkType } from '@/lib/jobs/work-type'
import { buildApplyKit, pickResume, profileSummary, resumeName, workAuthAnswer, type ApplyKitAnswer } from '@/lib/jobs/apply-kit'
import { applicationMessage, cleanShortAnswers, nativePosterOf, type ApplicationSnapshot } from '@/lib/jobs/native-apply'
import { deliverApplicationToPoster } from '@/lib/messaging/threads'
import { setJobStatus } from '@/app/dashboard/find-my-job/my-jobs-actions'

// Apply kit (every board job) and native one-click apply (jobs posted directly on
// NextChapter). Both read only the member's own profile; nothing here calls an
// LLM or a paid API.

const NOT_SIGNED_IN = 'Your session ended. Sign in again, then try once more.'
const NOT_FOUND = 'We could not find that job. It may have closed. Refresh the page and try again.'

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { user, profile: await getOrCreateCandidateProfile(user.id) }
}

// Same visibility rule as the job's own page (/dashboard/jobs/[id]): every member
// sees every board job; only privacy settings (archived, institution-scoped, excluded) hide one.
async function loadVisiblePosting(postingId: string) {
  const posting = await prisma.exclusiveJobPosting.findUnique({
    where: { id: postingId },
    select: {
      id: true, title: true, companyName: true, location: true, url: true, status: true, archivedAt: true, distribution: true,
      disclosure: true, institutionScopeId: true, source: true, description: true, employmentType: true,
      submittedByEmployerId: true, submittedByRecruiterId: true,
    },
  })
  if (!posting || posting.status !== 'approved' || posting.archivedAt || posting.institutionScopeId || posting.distribution === 'EXCLUDED') return null
  return posting
}

function kitProfile(p: CandidateProfile) {
  return {
    firstName: p.firstName,
    primaryFunction: p.primaryFunction,
    targetFunction: p.targetFunction,
    yearsExperience: p.yearsExperience,
    topStrengths: p.topStrengths,
    positioningStatementText: p.positioningStatementText,
    targetCompMin: p.targetCompMin,
    compFlexible: p.compFlexible,
    currentJobStatus: p.currentJobStatus,
    workAuthorization: p.workAuthorization,
    visaStatus: p.visaStatus,
    openToRelocation: p.openToRelocation,
    relocationNotes: p.relocationNotes,
    travelWillingness: p.travelWillingness,
    currentCity: p.currentCity,
    currentState: p.currentState,
  }
}

async function loadResumes(candidateId: string) {
  return prisma.resume.findMany({
    where: { candidateId, looksLikeResume: { not: false } },
    select: { id: true, label: true, fileName: true, description: true, uploadedAt: true },
    orderBy: { uploadedAt: 'desc' },
    take: 20,
  })
}

export type ApplyKitResult =
  | {
      ok: true
      answers: ApplyKitAnswer[]
      resume: { id: string; name: string; reason: string } | null
      resumeCount: number
      applied: boolean
    }
  | { ok: false; error: string }

export async function loadApplyKit(postingId: string): Promise<ApplyKitResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: NOT_SIGNED_IN }
  const { profile } = session
  // The apply kit is a Candidate+ extra (candidate-plus-extras.ts).
  if (!(await isDossierUnlocked(profile.id)).unlocked) return { ok: false, error: candidatePlusRequiredMessage('apply_kit') }
  const posting = await loadVisiblePosting(postingId)
  if (!posting) return { ok: false, error: NOT_FOUND }
  const [resumes, tracked] = await Promise.all([
    loadResumes(profile.id),
    prisma.trackedJob.findFirst({
      where: { candidateId: profile.id, source: 'job_board', sourceId: postingId },
      select: { jobPosting: { select: { appliedAt: true } } },
    }),
  ])
  const answers = buildApplyKit(kitProfile(profile), {
    title: posting.title,
    companyName: posting.companyName,
    confidential: posting.disclosure === 'CONFIDENTIAL',
    location: posting.location,
  })
  const pick = pickResume(resumes, posting.title)
  return {
    ok: true,
    answers,
    resume: pick ? { id: pick.resume.id, name: resumeName(pick.resume), reason: pick.reason } : null,
    resumeCount: resumes.length,
    applied: !!tracked?.jobPosting?.appliedAt,
  }
}

function trackRef(posting: { id: string; title: string; companyName: string; url: string; description: string | null; employmentType: string | null }) {
  return {
    source: 'job_board' as const,
    sourceId: posting.id,
    title: posting.title,
    companyName: posting.companyName,
    url: posting.url,
    workType: classifyWorkType(posting),
  }
}

/** "I applied" from the apply kit: logs the application in My jobs. */
export async function markAppliedFromKit(postingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession()
  if (!session) return { ok: false, error: NOT_SIGNED_IN }
  const posting = await loadVisiblePosting(postingId)
  if (!posting) return { ok: false, error: NOT_FOUND }
  const result = await setJobStatus(trackRef(posting), 'applied', 'apply_kit')
  if (result.ok) {
    captureServerEvent(session.profile.id, 'apply_kit_marked_applied', { jobId: postingId })
    revalidatePath(`/dashboard/jobs/${postingId}`)
  }
  return result
}

// ── Native one-click apply ──────────────────────────────────────────────────

export type NativeApplyPreview =
  | {
      ok: true
      snapshot: ApplicationSnapshot
      resumes: { id: string; name: string }[]
      suggestedResumeId: string | null
      confidentialMode: boolean
      posterLabel: string
      alreadyApplied: boolean
    }
  | { ok: false; error: string }

async function buildSnapshot(
  profile: CandidateProfile,
  authEmail: string | null,
  posting: { title: string; companyName: string; disclosure: string },
  resume: { id: string; name: string } | null,
  answers: { question: string; answer: string }[]
): Promise<ApplicationSnapshot> {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'NextChapter member'
  return {
    jobTitle: posting.title,
    companyLabel: posting.disclosure === 'CONFIDENTIAL' ? '' : posting.companyName,
    name,
    email: authEmail ?? profile.email ?? null,
    phone: profile.phone?.trim() || null,
    linkedInUrl: profile.linkedInUrl?.trim() || null,
    location: [profile.currentCity, profile.currentState].filter(Boolean).join(', ') || null,
    summary: profileSummary(kitProfile(profile)),
    workAuthorization: workAuthAnswer(profile),
    resume,
    answers,
  }
}

async function posterLabel(poster: { kind: 'employer' | 'recruiter'; id: string }, posting: { companyName: string; disclosure: string }) {
  if (poster.kind === 'recruiter') {
    const r = await prisma.recruiter.findUnique({ where: { id: poster.id }, select: { fullName: true } })
    return r?.fullName ? `${r.fullName}, the recruiter running this search` : 'the recruiter running this search'
  }
  return posting.disclosure === 'CONFIDENTIAL' ? 'the hiring team' : `the hiring team at ${posting.companyName}`
}

export async function loadNativeApplyPreview(postingId: string): Promise<NativeApplyPreview> {
  const session = await getSession()
  if (!session) return { ok: false, error: NOT_SIGNED_IN }
  const { profile, user } = session
  const posting = await loadVisiblePosting(postingId)
  const poster = posting && nativePosterOf(posting)
  if (!posting || !poster) return { ok: false, error: NOT_FOUND }
  const [resumes, existing] = await Promise.all([
    loadResumes(profile.id),
    prisma.nativeJobApplication.findUnique({ where: { candidateId_postingId: { candidateId: profile.id, postingId } }, select: { id: true } }),
  ])
  const pick = pickResume(resumes, posting.title)
  const resume = pick ? { id: pick.resume.id, name: resumeName(pick.resume) } : null
  captureServerEvent(profile.id, 'native_apply_started', { jobId: postingId, poster: poster.kind, confidentialMode: profile.confidentialSearchMode })
  return {
    ok: true,
    snapshot: await buildSnapshot(profile, user.email ?? null, posting, resume, []),
    resumes: resumes.map((r) => ({ id: r.id, name: resumeName(r) })),
    suggestedResumeId: resume?.id ?? null,
    confidentialMode: profile.confidentialSearchMode,
    posterLabel: await posterLabel(poster, posting),
    alreadyApplied: !!existing,
  }
}

export async function submitNativeApplication(input: {
  postingId: string
  resumeId: string | null
  answers: { question: string; answer: string }[]
  confidentialConfirmed: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession()
  if (!session) return { ok: false, error: NOT_SIGNED_IN }
  const { profile, user } = session
  const posting = await loadVisiblePosting(input.postingId)
  const poster = posting && nativePosterOf(posting)
  if (!posting || !poster) return { ok: false, error: NOT_FOUND }

  // Confidential Search Mode: sharing who they are needs its own, explicit yes.
  if (profile.confidentialSearchMode && !input.confidentialConfirmed) {
    return { ok: false, error: 'You are in Confidential Search Mode. Tick the box confirming you want to share your name with this poster, then send.' }
  }
  const existing = await prisma.nativeJobApplication.findUnique({
    where: { candidateId_postingId: { candidateId: profile.id, postingId: posting.id } },
    select: { id: true },
  })
  if (existing) return { ok: false, error: 'You already applied to this job through NextChapter. Your application is in My jobs.' }

  const resumeRow = input.resumeId
    ? await prisma.resume.findFirst({ where: { id: input.resumeId, candidateId: profile.id }, select: { id: true, label: true, fileName: true } })
    : null
  if (input.resumeId && !resumeRow) return { ok: false, error: 'That résumé is no longer on file. Pick another one and send again.' }
  const resume = resumeRow ? { id: resumeRow.id, name: resumeName(resumeRow) } : null

  const snapshot = await buildSnapshot(profile, user.email ?? null, posting, resume, cleanShortAnswers(input.answers))
  const thread = await deliverApplicationToPoster(
    profile.id,
    poster.kind === 'recruiter' ? 'RECRUITER' : 'EMPLOYER',
    poster.id,
    applicationMessage(snapshot),
    resume?.id ?? null
  )

  // Log it in My jobs (same JobPosting row the tracker and Gmail sync read).
  const status = await setJobStatus(trackRef(posting), 'applied', 'native')
  const tracked = status.ok
    ? await prisma.trackedJob.findFirst({ where: { candidateId: profile.id, source: 'job_board', sourceId: posting.id }, select: { jobPostingId: true } })
    : null

  await prisma.nativeJobApplication.create({
    data: {
      candidateId: profile.id,
      postingId: posting.id,
      jobPostingId: tracked?.jobPostingId ?? null,
      partnerType: poster.kind,
      partnerId: poster.id,
      threadId: thread.id,
      resumeId: resume?.id ?? null,
      shared: snapshot as unknown as object,
      confidentialConfirmed: profile.confidentialSearchMode && input.confidentialConfirmed,
    },
  })

  captureServerEvent(profile.id, 'native_apply_submitted', {
    jobId: posting.id,
    poster: poster.kind,
    hasResume: !!resume,
    answerCount: snapshot.answers.length,
    confidentialMode: profile.confidentialSearchMode,
  })
  revalidatePath(`/dashboard/jobs/${posting.id}`)
  revalidatePath('/dashboard/find-my-job')
  return { ok: true }
}
