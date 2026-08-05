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

export async function acknowledgeEmailActivity(activityId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await prisma.trackedEmailActivity.updateMany({
    where: { id: activityId, candidateId: profile.id, reviewedAt: null },
    data: { reviewedAt: new Date() },
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
  return {}
}
