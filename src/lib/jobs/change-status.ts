import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { linkApplicationToBoard } from '@/lib/jobs/application-posting-link'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { applicationStatus, matchClickToApplication, statusChangeData, type ApplicationStatus } from '@/lib/jobs/my-jobs'
import type { TrackRef } from '@/lib/jobs/my-jobs-data'

// Shared by the My jobs server actions and the apply-helper extension's log route
// (both act for an already-authenticated candidate).
type Result = { ok: true } | { ok: false; error: string }

function done() {
  revalidatePath('/dashboard/find-my-job')
  return { ok: true } as const
}

export async function upsertTracked(candidateId: string, ref: TrackRef) {
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

export async function changeStatus(
  candidateId: string,
  ref: TrackRef,
  to: ApplicationStatus,
  source: 'card' | 'my_jobs' | 'prompt' | 'email' | 'apply_kit' | 'native' | 'apply_helper'
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
