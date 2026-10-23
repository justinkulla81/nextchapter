'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { linkApplicationToBoard } from '@/lib/jobs/application-posting-link'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { addCompanyToWatchlist } from '@/lib/company-tracker/watchlist'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { applicationStatus, isApplicationStatus, matchClickToApplication, statusChangeData, type ApplicationStatus, type PromptAnswer } from '@/lib/jobs/my-jobs'
import { dismissBoardJob } from '@/app/dashboard/find-my-job/dismiss-actions'
import { candidatePlusProgress } from '@/lib/activity-log/log'
import { isWorkType, WORK_TYPES, type WorkType } from '@/lib/jobs/work-type'
import type { TrackRef } from '@/lib/jobs/my-jobs-data'

type Result = { ok: true } | { ok: false; error: string }

const NOT_SIGNED_IN: Result = { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
const SOURCES = new Set(['job_board', 'surfaced', 'matched_role', 'external'])

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

function cleanRef(ref: TrackRef): TrackRef | null {
  if (!ref || !SOURCES.has(ref.source) || !ref.sourceId || !ref.title?.trim()) return null
  return {
    source: ref.source,
    sourceId: ref.sourceId.slice(0, 64),
    title: ref.title.trim().slice(0, 300),
    companyName: ref.companyName?.trim().slice(0, 200) || null,
    url: ref.url?.trim().slice(0, 2000) || null,
    workType: isWorkType(ref.workType) ? ref.workType : 'full_time',
  }
}

function done() {
  revalidatePath('/dashboard/find-my-job')
  return { ok: true } as const
}

async function upsertTracked(candidateId: string, ref: TrackRef) {
  return prisma.trackedJob.upsert({
    where: { candidateId_source_sourceId: { candidateId, source: ref.source, sourceId: ref.sourceId } },
    create: {
      candidateId,
      source: ref.source,
      sourceId: ref.sourceId,
      title: ref.title,
      companyName: ref.companyName,
      url: ref.url,
      workType: ref.workType,
    },
    update: {},
    include: { jobPosting: true },
  })
}

/** Save (interested) or unsave a board job. */
export async function setJobSaved(rawRef: TrackRef, saved: boolean): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const ref = cleanRef(rawRef)
  if (!ref) return { ok: false, error: 'We could not find that job. Refresh the page and try again.' }

  const tracked = await upsertTracked(profile.id, ref)
  await prisma.trackedJob.update({
    where: { id: tracked.id },
    data: { savedAt: saved ? (tracked.savedAt ?? new Date()) : null, ...(saved ? { dismissedAt: null } : {}) },
  })
  // Partner-search jobs keep their own Interested reaction in step, so the
  // older lists and the admin rollups read the same answer.
  if (ref.source === 'surfaced') {
    await prisma.surfacedJob.updateMany({
      where: { id: ref.sourceId, candidateId: profile.id },
      data: saved ? { reaction: 'INTERESTED', reactionReason: null, reactedAt: new Date() } : { reaction: null, reactionReason: null, reactedAt: null },
    })
    // Same Search Action credit the old Interested button earned.
    if (saved) {
      const effort = estimateActionEffort({ actionType: 'JOB_INTERESTED_REACTION' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'JOB_INTERESTED_REACTION',
        text: 'Express interest in a job listing',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }
  captureServerEvent(profile.id, saved ? 'job_saved' : 'job_unsaved', { jobId: ref.sourceId, source: ref.source, type: ref.workType, trackedJobId: tracked.id })
  return done()
}

/**
 * Move a job to Applied / Interviewing / Offer / Closed. The application is a
 * JobPosting (source BOARD) — the same row the Application Tracker, Gmail sync and
 * every application stat read — created the first time the job is marked applied.
 */
export async function setJobStatus(
  rawRef: TrackRef,
  to: ApplicationStatus,
  source: 'card' | 'my_jobs' | 'prompt' | 'apply_kit' | 'native' = 'card'
): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const ref = cleanRef(rawRef)
  if (!ref || !isApplicationStatus(to)) return { ok: false, error: 'We could not update that job. Refresh the page and try again.' }
  return changeStatus(profile.id, ref, to, source)
}

async function changeStatus(
  candidateId: string,
  ref: TrackRef,
  to: ApplicationStatus,
  source: 'card' | 'my_jobs' | 'prompt' | 'email' | 'apply_kit' | 'native'
): Promise<Result> {
  const tracked = await upsertTracked(candidateId, ref)
  const now = new Date()
  let app = tracked.jobPosting
  // Already tracking this exact job in the Application Tracker (pasted its URL, or
  // promoted it for a fit check)? Use that row rather than a second one.
  if (!app && ref.url) {
    app = await prisma.jobPosting.findFirst({ where: { candidateId, url: ref.url, trackedJob: null } })
  }
  // Gmail already logged this application (a confirmation from the same company, and role
  // when the email names one, around the click)? Link that row instead of adding a second.
  if (!app && to === 'applied') {
    const emailApps = await prisma.jobPosting.findMany({
      where: { candidateId, source: 'EMAIL_DETECTED', appliedAt: { not: null }, trackedJob: null },
      orderBy: { appliedAt: 'desc' },
      take: 200,
    })
    const match = matchClickToApplication({ companyName: ref.companyName, title: ref.title, clickedAt: tracked.firstClickedAt ?? now }, emailApps)
    const emailApp = match ? emailApps.find((a) => a.id === match.id) : undefined
    if (emailApp) {
      await prisma.trackedJob.update({ where: { id: tracked.id }, data: { jobPostingId: emailApp.id, appliedVia: 'email', dismissedAt: null } })
      captureServerEvent(candidateId, 'application_auto_detected', { jobId: ref.sourceId, trackedJobId: tracked.id, jobPostingId: emailApp.id, source: ref.source, via: 'email', at: source })
      return done()
    }
  }
  const from = applicationStatus(app)
  if (from === to) return { ok: true }

  const empty = { appliedAt: null, interviewLandedAt: null, offerReceivedAt: null, declinedAt: null }
  const data = statusChangeData(app ?? empty, to, now)
  if (app) {
    await prisma.jobPosting.update({
      where: { id: app.id },
      data: { ...data, ...(to === 'closed' && !app.declinedAt ? { declinedBy: null } : {}) },
    })
  } else {
    app = await prisma.jobPosting.create({
      data: {
        candidateId,
        source: 'BOARD',
        fetchStatus: 'no_url',
        url: ref.url,
        title: ref.title,
        companyName: ref.companyName,
        channel: 'COLD_APPLICATION',
        ...data,
      },
    })
  }
  await prisma.trackedJob.update({
    where: { id: tracked.id },
    data: {
      jobPostingId: app.id,
      appliedVia: tracked.appliedVia ?? (source === 'prompt' || source === 'email' || source === 'native' ? source : 'manual'),
      dismissedAt: null,
    },
  })

  // Store the board link (the card itself) for admin application fit.
  if (!from) after(() => linkApplicationToBoard(app.id))

  // Applying is a real, verified Search Action — same credit as Mark applied in the tracker.
  if (!from) {
    const effort = estimateActionEffort({ actionType: 'JOB_APPLICATION_SUBMITTED' })
    await autoCompleteEngagementAction(candidateId, {
      actionType: 'JOB_APPLICATION_SUBMITTED',
      text: 'Apply to a job',
      points: effort.points,
      estimatedMinutes: effort.minutes,
    })
  }
  captureServerEvent(candidateId, 'job_application_status_changed', {
    jobId: ref.sourceId,
    trackedJobId: tracked.id,
    jobPostingId: app.id,
    from: from ?? 'none',
    to,
    source,
    type: ref.workType,
  })
  return done()
}

/** "You opened the application for X — did you apply?" */
export async function answerApplyPrompt(trackedJobId: string, answer: PromptAnswer): Promise<Result> {
  const r = await answerApplyPrompts([trackedJobId], answer)
  return r.ok ? { ok: true } : r
}

export type ApplyPromptsResult = { ok: true; progress: string | null } | { ok: false; error: string }

/**
 * The batched "Did you apply?" prompt on the board and Home: one answer for one or more
 * opened jobs. Yes logs each as applied in My jobs (appliedVia 'prompt') — a JobPosting with
 * appliedAt, which is exactly what Candidate+ counts — unless Gmail already logged it.
 * Not interested goes through the board's dismiss flow.
 */
export async function answerApplyPrompts(trackedJobIds: string[], answer: PromptAnswer): Promise<ApplyPromptsResult> {
  const profile = await getProfile()
  if (!profile) return { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
  if (answer !== 'applied' && answer !== 'not_yet' && answer !== 'not_interested') return { ok: false, error: 'Pick one of the three answers.' }
  const ids = [...new Set((Array.isArray(trackedJobIds) ? trackedJobIds : []).filter((id) => typeof id === 'string'))].slice(0, 10)
  const tracked = await prisma.trackedJob.findMany({ where: { id: { in: ids }, candidateId: profile.id } })
  if (tracked.length === 0) return { ok: false, error: 'We could not find that job. Refresh the page and try again.' }

  const now = new Date()
  for (const t of tracked) {
    await prisma.trackedJob.update({
      where: { id: t.id },
      data: { promptAnswer: answer, promptAnsweredAt: now, ...(answer === 'not_interested' ? { dismissedAt: now, savedAt: null } : {}) },
    })
    captureServerEvent(profile.id, 'application_prompt_answered', { jobId: t.sourceId, trackedJobId: t.id, source: t.source, answer })
    if (answer === 'not_interested' && t.source === 'job_board') {
      await dismissBoardJob(t.sourceId, [], null)
    } else if (answer === 'applied') {
      const r = await changeStatus(
        profile.id,
        {
          source: t.source as TrackRef['source'],
          sourceId: t.sourceId,
          title: t.title,
          companyName: t.companyName,
          url: t.url,
          workType: isWorkType(t.workType) ? t.workType : 'full_time',
        },
        'applied',
        'prompt'
      )
      if (!r.ok) return { ok: false, error: r.error }
    }
  }
  captureServerEvent(profile.id, 'apply_prompt_answered', { answer, count: tracked.length, jobIds: tracked.map((t) => t.sourceId) })
  revalidatePath('/dashboard')
  const progress = answer === 'applied' ? (await candidatePlusProgress(profile.id, 'applications')).line : null
  done()
  return { ok: true, progress }
}

/** Watch or stop watching a company (the Company Tracker watchlist). */
export async function setCompanyWatched(companyName: string, watch: boolean, companyId: string | null = null): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const name = companyName?.trim()
  const normalized = name ? normalizeOrgName(name) : ''
  if (!normalized) return { ok: false, error: 'This job has no company name to watch.' }
  if (watch) {
    const r = await addCompanyToWatchlist(profile.id, name)
    if (r.error && !/already on your watchlist/i.test(r.error)) return { ok: false, error: r.error }
  } else {
    await prisma.companyWatchlistEntry.deleteMany({ where: { candidateId: profile.id, companyNameNormalized: normalized } })
  }
  captureServerEvent(profile.id, 'company_watch_toggled', { companyId: companyId ?? normalized, companyName: name, watching: watch })
  revalidatePath('/dashboard', 'layout')
  return done()
}

/** Remember the work types the member picked on the board. */
export async function saveBoardWorkTypes(types: WorkType[]): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const clean = WORK_TYPES.filter((t) => types.includes(t))
  if (clean.length === 0) return { ok: false, error: 'Pick at least one kind of work.' }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { jobBoardWorkTypes: clean } })
  return { ok: true }
}

/** Status change for an application with no board job behind it (found in Gmail, or logged in the tracker). */
export async function setApplicationStatusById(jobPostingId: string, to: ApplicationStatus): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  if (!isApplicationStatus(to)) return { ok: false, error: 'Pick one of the four statuses.' }
  const app = await prisma.jobPosting.findFirst({ where: { id: jobPostingId, candidateId: profile.id } })
  if (!app) return { ok: false, error: 'We could not find that application. Refresh the page and try again.' }
  const from = applicationStatus(app)
  if (from === to) return { ok: true }
  await prisma.jobPosting.update({
    where: { id: app.id },
    data: { ...statusChangeData(app, to, new Date()), ...(to === 'closed' && !app.declinedAt ? { declinedBy: null } : {}) },
  })
  captureServerEvent(profile.id, 'job_application_status_changed', {
    jobId: app.id,
    jobPostingId: app.id,
    from: from ?? 'none',
    to,
    source: app.source === 'EMAIL_DETECTED' ? 'my_jobs_email' : 'my_jobs_tracker',
  })
  return done()
}
