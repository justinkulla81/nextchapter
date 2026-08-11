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
