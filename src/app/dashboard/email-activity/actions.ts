'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { captureServerEvent } from '@/lib/posthog/server'

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// Read-only access only — this disconnects the connection (revokes nothing
// send/modify/delete-capable, because none of that capability was ever
// granted in the first place) and stops further syncing. Past detected
// activity and its points are not clawed back.
export async function disconnectGmail(): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await prisma.emailConnection.updateMany({
    where: { candidateId: profile.id, disconnectedAt: null },
    data: { disconnectedAt: new Date() },
  })
  captureServerEvent(profile.id, 'gmail_disconnected')
  revalidatePath('/dashboard/network')
}

// The candidate is telling us the auto-detected classification was wrong —
// excludes it from every stat count and detail list going forward. Points
// already awarded for it are not clawed back (mirrors disconnectGmail's
// "past activity stands" rule above).
export async function dismissEmailActivity(activityId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await prisma.trackedEmailActivity.updateMany({
    where: { id: activityId, candidateId: profile.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
  revalidatePath('/dashboard/network')
}

export async function syncNowAction(): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const connection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  if (!connection) return { error: 'No connected mailbox to sync.' }

  const result = await syncGmailConnection(connection.id)
  if (result === null) {
    return { error: 'Your Gmail connection needs to be reconnected — the sign-in expired.' }
  }
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/find-my-job')
  return {}
}

// Ordinary syncs only look back to the last successful sync (see
// sync-gmail.ts) — cheap, but it means a message that arrived before the
// candidate's very first sync (or during any gap) is never picked up by a
// routine "Check now" click. This resets the high-water mark so the next
// sync re-scans the full 90-day backfill window instead, at the cost of a
// slower one-off request. Per-message dedup (externalMessageId) means
// nothing already tracked gets duplicated or reprocessed.
export async function forceFullResyncAction(): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const connection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  if (!connection) return { error: 'No connected mailbox to sync.' }

  await prisma.emailConnection.update({ where: { id: connection.id }, data: { lastSyncAt: null } })

  const result = await syncGmailConnection(connection.id)
  if (result === null) {
    return { error: 'Your Gmail connection needs to be reconnected — the sign-in expired.' }
  }
  captureServerEvent(profile.id, 'email_force_full_resync', { synced: result.synced })
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/find-my-job')
  return {}
}

const REASONS = new Set(['NOT_A_REJECTION', 'NOT_AN_INTERVIEW', 'NOT_AN_OFFER', 'NOT_AN_APPLICATION', 'NOT_JOB_RELATED', 'DUPLICATE', 'WRONG_COMPANY', 'OTHER'])
const DAY = 86_400_000

/**
 * "This detection is wrong" with a reason — hides it everywhere (same as
 * dismissEmailActivity) and keeps a feedback record with the rule that fired,
 * so the classifier can be fixed by rule rather than one email at a time. A
 * wrong rejection also stops marking the matching application rejected; a
 * wrong application confirmation also removes the application it created.
 */
export async function reportWrongDetection(activityId: string, reason: string): Promise<void> {
  const profile = await getProfile()
  if (!profile || !REASONS.has(reason)) return
  const activity = await prisma.trackedEmailActivity.findFirst({ where: { id: activityId, candidateId: profile.id, dismissedAt: null } })
  if (!activity) return

  await prisma.trackedEmailActivity.update({ where: { id: activity.id }, data: { dismissedAt: new Date() } })
  await prisma.classificationFeedback.create({
    data: {
      candidateId: profile.id, recordKind: 'EMAIL_ACTIVITY', recordId: activity.id,
      detectedAs: activity.activityType, reason, subject: activity.subject, fromAddress: activity.fromAddress,
      companyName: activity.companyName, matchedRule: activity.matchedRule,
    },
  })

  if (activity.companyName) {
    const company = activity.companyName
    const apps = await prisma.jobPosting.findMany({ where: { candidateId: profile.id, companyName: { equals: company, mode: 'insensitive' } } })
    if (activity.activityType === 'REJECTION') {
      // Only if no other (still-trusted) rejection from that company backs it up.
      const other = await prisma.trackedEmailActivity.count({
        where: { candidateId: profile.id, activityType: 'REJECTION', dismissedAt: null, companyName: { equals: company, mode: 'insensitive' } },
      })
      if (other === 0) {
        await prisma.jobPosting.updateMany({
          where: { id: { in: apps.map((a) => a.id) }, declinedBy: 'COMPANY' },
          data: { declinedAt: null, declinedBy: null },
        })
      }
    }
    if (activity.activityType === 'APPLICATION_CONFIRMATION') {
      const near = apps.filter((a) => a.source === 'EMAIL_DETECTED' && a.appliedAt && Math.abs(a.appliedAt.getTime() - activity.detectedAt.getTime()) < 45 * DAY)
      if (near.length > 0) await prisma.jobPosting.deleteMany({ where: { id: { in: near.map((a) => a.id) } } })
    }
  }

  captureServerEvent(profile.id, 'email_detection_reported_wrong', { activityType: activity.activityType, reason, rule: activity.matchedRule ?? null })
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard/network')
  revalidatePath('/dashboard/market-reality')
}

/** Removes an application that isn't real (a misread confirmation, a duplicate), with a reason. */
export async function removeJobApplication(jobPostingId: string, reason: string): Promise<void> {
  const profile = await getProfile()
  if (!profile || !REASONS.has(reason)) return
  const app = await prisma.jobPosting.findFirst({ where: { id: jobPostingId, candidateId: profile.id } })
  if (!app) return

  // The confirmation email that created it, when there is one — hidden too,
  // so a later sync or rescan can't bring the application back.
  const confirmation = app.companyName && app.source === 'EMAIL_DETECTED'
    ? await prisma.trackedEmailActivity.findFirst({
        where: {
          candidateId: profile.id, activityType: 'APPLICATION_CONFIRMATION', dismissedAt: null,
          companyName: { equals: app.companyName, mode: 'insensitive' },
          ...(app.appliedAt ? { detectedAt: { gte: new Date(app.appliedAt.getTime() - 45 * DAY) } } : {}),
        },
        orderBy: { detectedAt: 'asc' },
      })
    : null
  if (confirmation) await prisma.trackedEmailActivity.update({ where: { id: confirmation.id }, data: { dismissedAt: new Date() } })

  await prisma.classificationFeedback.create({
    data: {
      candidateId: profile.id, recordKind: 'JOB_APPLICATION', recordId: app.id, detectedAs: 'APPLICATION', reason,
      subject: confirmation?.subject ?? app.title, fromAddress: confirmation?.fromAddress ?? null,
      companyName: app.companyName, matchedRule: confirmation?.matchedRule ?? (app.source === 'EMAIL_DETECTED' ? null : `added ${app.source}`),
    },
  })
  await prisma.jobPosting.delete({ where: { id: app.id } })

  captureServerEvent(profile.id, 'job_application_removed', { source: app.source, reason })
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard/market-reality')
}
