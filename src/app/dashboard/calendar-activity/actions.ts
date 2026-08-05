'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
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
export async function disconnectCalendar(): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await prisma.calendarConnection.updateMany({
    where: { candidateId: profile.id, disconnectedAt: null },
    data: { disconnectedAt: new Date() },
  })
  captureServerEvent(profile.id, 'calendar_disconnected')
  revalidatePath('/dashboard/network')
}

export async function syncCalendarNowAction(): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const connection = await prisma.calendarConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })
  if (!connection) return { error: 'No connected calendar to sync.' }

  const result = await syncGoogleCalendarConnection(connection.id)
  if (result === null) {
    return { error: 'Your calendar connection needs to be reconnected — the sign-in expired.' }
  }
  revalidatePath('/dashboard/network')
  return {}
}

export async function acknowledgeCalendarEvent(eventId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await prisma.trackedCalendarEvent.updateMany({
    where: { id: eventId, candidateId: profile.id, reviewedAt: null },
    data: { reviewedAt: new Date() },
  })
  revalidatePath('/dashboard/network')
}
