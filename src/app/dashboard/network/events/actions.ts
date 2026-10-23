'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { redirect } from 'next/navigation'

const STATUSES = ['SAVED', 'GOING', 'SPEAKING'] as const

/** Marks an event saved, going or speaking for the signed-in member. Pressing the same state again clears it. */
export async function setEventInterest(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const profile = await getOrCreateCandidateProfile(user.id)
  const eventId = String(formData.get('eventId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!eventId || !(STATUSES as readonly string[]).includes(status)) return
  const event = await prisma.conferenceEvent.findFirst({ where: { id: eventId, published: true }, select: { id: true, importance: true, access: true, speaking: true } })
  if (!event) return
  const current = await prisma.conferenceInterest.findUnique({ where: { candidateId_eventId: { candidateId: profile.id, eventId } } })
  if (current?.status === status) {
    await prisma.conferenceInterest.delete({ where: { id: current.id } })
    captureServerEvent(profile.id, 'conference_event_interest_cleared', { eventId, status })
  } else {
    await prisma.conferenceInterest.upsert({
      where: { candidateId_eventId: { candidateId: profile.id, eventId } },
      create: { candidateId: profile.id, eventId, status },
      update: { status },
    })
    captureServerEvent(profile.id, 'conference_event_interest_set', { eventId, status, previous: current?.status ?? null, access: event.access, speaking: event.speaking, importance: event.importance })
  }
  revalidatePath('/dashboard/network/events')
}
