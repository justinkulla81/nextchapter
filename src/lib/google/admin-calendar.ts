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
  // Paged, because a long catch-up window after an outage can hold more
  // events than one page — and the page is ordered oldest first, so a cut
  // would drop the newest meetings, the ones about to happen.
  const MAX_EVENTS = 1500
  const out: CalendarEventSummary[] = []
  let pageToken: string | undefined
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    url.searchParams.set('timeMin', from.toISOString())
    url.searchParams.set('timeMax', to.toISOString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', String(max))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    url.searchParams.set('fields', 'nextPageToken,items(id,summary,start,hangoutLink,conferenceData(entryPoints(entryPointType,uri)),attachments(fileId,fileUrl,title,mimeType),attendees(email,displayName,responseStatus),organizer(email))')

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Calendar list failed: ${res.status}${await googleErrorReason(res)}`)
    const data = (await res.json()) as {
      nextPageToken?: string
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

    out.push(...(data.items ?? [])
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
      })))
    pageToken = data.nextPageToken
  } while (pageToken && out.length < MAX_EVENTS)
  return out
}

/**
 * Why a notes fetch produced nothing. `needs_reconnect` is the actionable one
 * (the grant lacks Docs access); `inaccessible` is one doc this account can't
 * open (not shared with it) — the other connected account may still read it;
 * `api_disabled` is the Docs API switched off in the Cloud project (enable it
 * there); `failed` is Google having a bad moment, worth retrying on the next sweep.
 */
export class NotesFetchError extends Error {
  constructor(public readonly kind: 'needs_reconnect' | 'api_disabled' | 'inaccessible' | 'failed', message: string) {
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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Only a token problem means "reconnect". A 403/404 on its own is just a
    // document this account was never given, which no reconnect would fix.
    if (res.status === 401 || /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|insufficientPermissions/i.test(body)) {
      throw new NotesFetchError('needs_reconnect', `Docs read refused: ${res.status} ACCESS_TOKEN_SCOPE_INSUFFICIENT`)
    }
    // The Docs API itself switched off in the Google Cloud project: no document
    // can be read until someone enables it, and no reconnect changes that.
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used in project|API has not been enabled/i.test(body)) {
      // The project number Google names is what to look for in the Cloud console.
      const project = body.match(/project[s/ ]+(\d{6,})/i)?.[1]
      throw new NotesFetchError('api_disabled', project ? ` (project ${project})` : '')
    }
    if (res.status === 403 || res.status === 404) throw new NotesFetchError('inaccessible', `Docs read: ${res.status}`)
    throw new NotesFetchError('failed', `Docs read failed: ${res.status}`)
  }
  return docToText((await res.json()) as GoogleDocJson)
}

/**
 * A to-do reminder on the primary calendar: a short timed event at 9:00 ET
 * on the due date with a pop-up at the start. No attendees, so nobody is
 * invited and nothing is sent to anyone. Returns the new event's id.
 * Needs only the calendar.events scope the sweep already holds.
 */
export async function createReminderEvent(
  accessToken: string,
  input: { title: string; description: string; dueDate: string },
): Promise<string> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `To do: ${input.title}`,
      description: input.description,
      start: { dateTime: `${input.dueDate}T09:00:00`, timeZone: 'America/New_York' },
      end: { dateTime: `${input.dueDate}T09:15:00`, timeZone: 'America/New_York' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    }),
  })
  if (!res.ok) throw new Error(`Reminder create failed: ${res.status}${await googleErrorReason(res)}`)
  return ((await res.json()) as { id: string }).id
}
