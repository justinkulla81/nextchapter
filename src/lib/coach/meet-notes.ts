import 'server-only'
import { prisma } from '@/lib/prisma'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import { fetchGoogleDocText, NotesFetchError } from '@/lib/google/admin-calendar'
import { capNotes, geminiNotesDocOf, type CalendarAttachment } from '@/lib/google/meeting-notes'

// Gemini's notes for a coach's booked call, read from the calendar event the booking made (CoachBooking.googleEventId).
// Only the "Notes by Gemini" document is read, never the transcript document (geminiNotesDocOf skips it).

const DAY_MS = 24 * 3600 * 1000

export type MeetNotesResult =
  | { ok: true; text: string; title: string }
  | { ok: false; reason: 'no_booking' | 'no_notes_yet' | 'needs_reconnect' | 'unavailable'; message: string }

/** The booking this session belongs to: the coach's confirmed booking with this member closest to the session, within a day. */
export function pickBookingForSession<T extends { startsAt: Date; googleEventId: string | null }>(bookings: T[], occurredAt: Date): T | null {
  const withEvent = bookings.filter((b) => b.googleEventId)
  let best: T | null = null
  let bestGap = Infinity
  for (const b of withEvent) {
    const gap = Math.abs(b.startsAt.getTime() - occurredAt.getTime())
    if (gap <= DAY_MS && gap < bestGap) {
      best = b
      bestGap = gap
    }
  }
  return best
}

export async function findBookingForSession(coachId: string, candidateId: string, occurredAt: Date) {
  const bookings = await prisma.coachBooking.findMany({
    where: { coachId, candidateId, status: 'CONFIRMED', startsAt: { gte: new Date(occurredAt.getTime() - DAY_MS), lte: new Date(occurredAt.getTime() + DAY_MS) } },
    select: { id: true, startsAt: true, googleEventId: true, meetUrl: true },
  })
  return pickBookingForSession(bookings, occurredAt)
}

export async function fetchMeetNotes(coachId: string, candidateId: string, occurredAt: Date): Promise<MeetNotesResult> {
  const booking = await findBookingForSession(coachId, candidateId, occurredAt)
  if (!booking?.googleEventId) {
    return { ok: false, reason: 'no_booking', message: 'This session was not booked here, so there is no call to read notes from. Paste your notes instead.' }
  }
  try {
    const token = await getValidAdminAccessToken()
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(booking.googleEventId)}`)
    url.searchParams.set('fields', 'attachments(fileId,fileUrl,title,mimeType)')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return { ok: false, reason: 'unavailable', message: 'We could not reach the calendar just now. Paste your notes, or try again in a minute.' }
    const event = (await res.json()) as { attachments?: CalendarAttachment[] }
    const doc = geminiNotesDocOf(event.attachments)
    if (!doc) return { ok: false, reason: 'no_notes_yet', message: 'No “Notes by Gemini” are attached to the call yet. Google adds them a few minutes after the call ends. Try again soon, or paste your notes.' }
    const text = await fetchGoogleDocText(token, doc.fileId)
    if (!text.trim()) return { ok: false, reason: 'no_notes_yet', message: 'The Gemini notes are empty so far. Try again soon, or paste your notes.' }
    return { ok: true, text: capNotes(text), title: doc.title }
  } catch (error) {
    if (error instanceof NotesFetchError && error.kind === 'needs_reconnect') {
      return { ok: false, reason: 'needs_reconnect', message: 'Reading the call notes needs Google access that is not set up yet. Paste your notes instead.' }
    }
    console.error('Failed to read Gemini notes for a coach session:', error)
    return { ok: false, reason: 'unavailable', message: 'We could not read the Gemini notes just now. Paste your notes, or try again in a minute.' }
  }
}
