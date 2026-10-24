import 'server-only'
import { getValidAdminAccessToken } from '@/lib/webinars/admin-calendar-oauth'
import { googleErrorReason } from '@/lib/google/error-reason'

// Creates and removes calendar events on NextChapter's connected Google Calendar, the same
// connection webinars use. Callers treat a null/false result as "the calendar was not
// available" and carry on without a Meet link, never as a reason to fail what the user did.
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export async function createMeetEvent(input: {
  summary: string
  description: string
  start: Date
  end: Date
  attendeeEmails: string[]
  /** Idempotency key for the Meet link request. */
  requestId: string
}): Promise<{ eventId: string; meetUrl: string | null } | null> {
  try {
    const accessToken = await getValidAdminAccessToken()
    // sendUpdates=all: Google emails each attendee the invitation.
    const response = await fetch(`${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    })
    if (!response.ok) {
      console.error('Failed to create calendar event:', response.status, await googleErrorReason(response))
      return null
    }
    const event = (await response.json()) as { id?: string; hangoutLink?: string }
    return event.id ? { eventId: event.id, meetUrl: event.hangoutLink ?? null } : null
  } catch (error) {
    console.error('Failed to create calendar event:', error)
    return null
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const accessToken = await getValidAdminAccessToken()
    const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 410 Gone: already deleted, which is the state we wanted.
    return response.ok || response.status === 410
  } catch (error) {
    console.error('Failed to delete calendar event:', error)
    return false
  }
}

/** Moves an event on the shared calendar to a new time. The Meet link stays. False when Google would not change it. */
export async function moveCalendarEvent(eventId: string, start: Date, end: Date): Promise<boolean> {
  try {
    const accessToken = await getValidAdminAccessToken()
    const response = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
    })
    if (!response.ok) console.error('Failed to move calendar event:', response.status, await googleErrorReason(response))
    return response.ok
  } catch (error) {
    console.error('Failed to move calendar event:', error)
    return false
  }
}
