import 'server-only'
import { coachGoogleFetch, CoachGoogleError } from '@/lib/coach/google/connection'
import { parseFreeBusy, type ParsedFreeBusy, type FreeBusyResponse } from '@/lib/coach/google/freebusy'
import { googleErrorReason } from '@/lib/google/error-reason'

// Calls to the coach's OWN Google Calendar. Reading is only ever free/busy (the calendar.freebusy scope gives no titles or
// guests), and we change or delete only events we created: callers pass the event id stored on the CoachBooking.
const API = 'https://www.googleapis.com/calendar/v3'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const eventUrl = (calendarId: string, eventId?: string) => `${API}/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`

/** Busy time across the coach's selected calendars. Throws CoachGoogleError when the coach's calendar cannot be read. */
export async function queryCoachBusy(coachId: string, from: Date, to: Date, calendarIdsOverride?: string[]): Promise<ParsedFreeBusy> {
  let requested: string[] = []
  const response = await coachGoogleFetch(coachId, (accessToken, calendarIds) => {
    requested = calendarIdsOverride ?? calendarIds
    return fetch(`${API}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, ...JSON_HEADERS },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: requested.map((id) => ({ id })) }),
    })
  })
  if (!response.ok) {
    console.error('Coach free/busy failed:', response.status, await googleErrorReason(response))
    throw new CoachGoogleError('transient', 'Could not read the coach’s calendar just now.')
  }
  return parseFreeBusy((await response.json()) as FreeBusyResponse, requested)
}

export interface CoachEventInput {
  summary: string
  description: string
  start: Date
  end: Date
  attendeeEmails: string[]
  /** Idempotency key for the Meet link request, and the tag that marks the event as ours. */
  bookingId: string
}

/** Creates the session on the coach's first selected calendar, with a Meet link and the client as a guest. Throws CoachGoogleError on failure. */
export async function createCoachMeetEvent(coachId: string, input: CoachEventInput): Promise<{ eventId: string; meetUrl: string | null; calendarId: string }> {
  let calendarId = 'primary'
  const response = await coachGoogleFetch(coachId, (accessToken, calendarIds) => {
    calendarId = calendarIds[0] ?? 'primary'
    // sendUpdates=all: Google emails each guest the invitation, which is our booking confirmation.
    return fetch(`${eventUrl(calendarId)}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, ...JSON_HEADERS },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }] },
        extendedProperties: { private: { nextchapterBookingId: input.bookingId } },
        conferenceData: { createRequest: { requestId: input.bookingId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    })
  })
  if (!response.ok) {
    console.error('Coach calendar event not created:', response.status, await googleErrorReason(response))
    throw new CoachGoogleError('transient', 'Could not add the session to the coach’s calendar.')
  }
  const event = (await response.json()) as { id?: string; hangoutLink?: string }
  if (!event.id) throw new CoachGoogleError('transient', 'Google did not return an event id.')
  return { eventId: event.id, meetUrl: event.hangoutLink ?? null, calendarId }
}

/** Moves an event we made to a new time. The Meet link stays the same. Returns false when Google would not change it. */
export async function moveCoachEvent(coachId: string, calendarId: string, eventId: string, start: Date, end: Date): Promise<boolean> {
  try {
    const response = await coachGoogleFetch(coachId, (accessToken) =>
      fetch(`${eventUrl(calendarId, eventId)}?sendUpdates=all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, ...JSON_HEADERS },
        body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
      })
    )
    if (!response.ok) console.error('Coach calendar event not moved:', response.status, await googleErrorReason(response))
    return response.ok
  } catch (error) {
    console.error('Coach calendar event not moved:', error)
    return false
  }
}

/** Deletes an event we made. 404 and 410 mean it is already gone, which is the state we wanted. */
export async function deleteCoachEvent(coachId: string, calendarId: string, eventId: string): Promise<boolean> {
  try {
    const response = await coachGoogleFetch(coachId, (accessToken) =>
      fetch(`${eventUrl(calendarId, eventId)}?sendUpdates=all`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
    )
    return response.ok || response.status === 404 || response.status === 410
  } catch (error) {
    console.error('Coach calendar event not deleted:', error)
    return false
  }
}
