import 'server-only'
import { googleErrorReason } from './error-reason'
import { meetUrlOf, geminiNotesDocOf, docToText, type CalendarAttachment, type GoogleDocJson, type NotesDoc } from './meeting-notes'

export interface CalendarAttendee {
  email: string | null
  displayName: string | null
}
export interface CalendarEventSummary {
  id: string
  summary: string | null
  start: Date
  attendees: CalendarAttendee[]
  organizerEmail: string | null
  /** Google Meet join link, when the event has one. */
  meetUrl: string | null
  /** The "Notes by Gemini" doc Meet attached once the call ended. */
  notesDoc: NotesDoc | null
}

/**
 * Events in a window from the admin's primary calendar.
 *
 * Attendee lists only — descriptions are not requested. A meeting with someone
 * is the strongest signal a relationship is real, and none of that signal is in
 * the body.
 */
export async function listCalendarEvents(
  accessToken: string,
  from: Date,
  to: Date,
  max = 250
): Promise<CalendarEventSummary[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', from.toISOString())
  url.searchParams.set('timeMax', to.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', String(max))
  url.searchParams.set('fields', 'items(id,summary,start,hangoutLink,conferenceData(entryPoints(entryPointType,uri)),attachments(fileId,fileUrl,title,mimeType),attendees(email,displayName,responseStatus),organizer(email))')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status}${await googleErrorReason(res)}`)
  const data = (await res.json()) as {
    items?: {
      id: string
      summary?: string
      start?: { dateTime?: string; date?: string }
      attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
      organizer?: { email?: string }
      hangoutLink?: string
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] }
      attachments?: CalendarAttachment[]
    }[]
  }

  return (data.items ?? [])
    .filter((e) => e.start?.dateTime || e.start?.date)
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      start: new Date(e.start!.dateTime ?? `${e.start!.date}T00:00:00Z`),
      organizerEmail: e.organizer?.email?.toLowerCase() ?? null,
      meetUrl: meetUrlOf(e),
      notesDoc: geminiNotesDocOf(e.attachments),
      attendees: (e.attendees ?? [])
        // A declined attendee did not meet you.
        .filter((a) => a.responseStatus !== 'declined')
        .map((a) => ({ email: a.email?.toLowerCase() ?? null, displayName: a.displayName ?? null })),
    }))
}

/** Why a notes fetch produced nothing — `needs_reconnect` is the actionable one. */
export class NotesFetchError extends Error {
  constructor(public readonly kind: 'needs_reconnect' | 'failed', message: string) {
    super(message)
  }
}

/**
 * Text of one Google Doc via the Docs API.
 *
 * Needs `documents.readonly`, which connections made before Gemini notes
 * were wired in don't have — Google answers those with 403 / 401 and the
 * caller reports "reconnect Google" rather than treating it as a failure.
 */
export async function fetchGoogleDocText(accessToken: string, fileId: string): Promise<string> {
  const url = new URL(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(fileId)}`)
  url.searchParams.set('includeTabsContent', 'true')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 401 || res.status === 403) {
    throw new NotesFetchError('needs_reconnect', `Docs read refused: ${res.status}${await googleErrorReason(res)}`)
  }
  if (!res.ok) throw new NotesFetchError('failed', `Docs read failed: ${res.status}${await googleErrorReason(res)}`)
  return docToText((await res.json()) as GoogleDocJson)
}
