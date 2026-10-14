'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { addCompanyToWatchlist } from '@/lib/company-tracker/watchlist'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { applicationStatus, isApplicationStatus, statusChangeData, type ApplicationStatus, type PromptAnswer } from '@/lib/jobs/my-jobs'
import { isWorkType, WORK_TYPES, type WorkType } from '@/lib/jobs/work-type'
import type { TrackRef } from '@/lib/jobs/my-jobs-data'

type Result = { ok: true } | { ok: false; error: string }

const NOT_SIGNED_IN: Result = { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
const SOURCES = new Set(['job_board', 'surfaced', 'matched_role'])

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
  source: 'card' | 'my_jobs' | 'prompt' = 'card'
): Promise<Result> {
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  const ref = cleanRef(rawRef)
  if (!ref || !isApplicationStatus(to)) return { ok: false, error: 'We could not update that job. Refresh the page and try again.' }
  return changeStatus(profile.id, ref, to, source)
}

async function changeStatus(candidateId: string, ref: TrackRef, to: ApplicationStatus, source: 'card' | 'my_jobs' | 'prompt' | 'email'): Promise<Result> {
  const tracked = await upsertTracked(candidateId, ref)
  const now = new Date()
  let app = tracked.jobPosting
  // Already tracking this exact job in the Application Tracker (pasted its URL, or
  // promoted it for a fit check)? Use that row rather than a second one.
  if (!app && ref.url) {
    app = await prisma.jobPosting.findFirst({ where: { candidateId, url: ref.url, trackedJob: null } })
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
      appliedVia: tracked.appliedVia ?? (source === 'prompt' ? 'prompt' : source === 'email' ? 'email' : 'manual'),
      dismissedAt: null,
    },
  })

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
  const profile = await getProfile()
  if (!profile) return NOT_SIGNED_IN
  if (answer !== 'applied' && answer !== 'not_yet' && answer !== 'not_interested') return { ok: false, error: 'Pick one of the three answers.' }
  const tracked = await prisma.trackedJob.findFirst({ where: { id: trackedJobId, candidateId: profile.id } })
  if (!tracked) return { ok: false, error: 'We could not find that job. Refresh the page and try again.' }

  const now = new Date()
  await prisma.trackedJob.update({
    where: { id: tracked.id },
    data: {
      promptAnswer: answer,
      promptAnsweredAt: now,
      ...(answer === 'not_interested' ? { dismissedAt: now, savedAt: null } : {}),
    },
  })
  captureServerEvent(profile.id, 'application_prompt_answered', { jobId: tracked.sourceId, trackedJobId: tracked.id, source: tracked.source, answer })
  if (answer === 'applied') {
    return changeStatus(
      profile.id,
      {
        source: tracked.source as TrackRef['source'],
        sourceId: tracked.sourceId,
        title: tracked.title,
        companyName: tracked.companyName,
        url: tracked.url,
        workType: isWorkType(tracked.workType) ? tracked.workType : 'full_time',
      },
      'applied',
      'prompt'
    )
  }
  return done()
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
