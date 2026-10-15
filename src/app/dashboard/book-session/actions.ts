'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { bookSlot, cancelBooking } from '@/lib/coach/booking/service'

export type BookSessionState = { error?: string; message?: string } | undefined

async function currentCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

export async function bookSession(_prev: BookSessionState, formData: FormData): Promise<BookSessionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }
  if (!profile.coachId) return { error: 'You do not have a coach yet. Choose one first, then book a session.' }

  const startsAt = new Date(String(formData.get('startsAt') ?? ''))
  if (Number.isNaN(startsAt.getTime())) return { error: 'Choose a day and a time first.' }

  const result = await bookSlot({ coachId: profile.coachId, candidateId: profile.id, startsAt })
  if (!result.ok) return { error: result.error }

  captureServerEvent(profile.id, 'coach_session_booked', {
    bookingId: result.bookingId,
    coachId: profile.coachId,
    candidateId: profile.id,
    leadHours: Math.round((startsAt.getTime() - Date.now()) / 3_600_000),
    hasMeetLink: result.meetUrl !== null,
  })
  revalidatePath('/dashboard/book-session')
  return { message: 'Booked. Check your email for the details.' }
}

export async function cancelMySession(_prev: BookSessionState, formData: FormData): Promise<BookSessionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }
  const bookingId = String(formData.get('bookingId') ?? '')
  const result = await cancelBooking({ bookingId, by: 'CANDIDATE', candidateId: profile.id })
  if (!result.ok) return { error: result.error }
  captureServerEvent(profile.id, 'coach_session_cancelled', { bookingId, coachId: result.coachId, candidateId: profile.id, by: 'CANDIDATE' })
  revalidatePath('/dashboard/book-session')
  return {
    message: result.calendarWarning
      ? 'Cancelled here. We could not remove the calendar invitation, so please delete it from your Google Calendar.'
      : 'Cancelled.',
  }
}
