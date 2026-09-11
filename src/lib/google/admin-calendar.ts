import 'server-only'

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
  url.searchParams.set('fields', 'items(id,summary,start,attendees(email,displayName,responseStatus),organizer(email))')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status}`)
  const data = (await res.json()) as {
    items?: {
      id: string
      summary?: string
      start?: { dateTime?: string; date?: string }
      attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
      organizer?: { email?: string }
    }[]
  }

  return (data.items ?? [])
    .filter((e) => e.start?.dateTime || e.start?.date)
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      start: new Date(e.start!.dateTime ?? `${e.start!.date}T00:00:00Z`),
      organizerEmail: e.organizer?.email?.toLowerCase() ?? null,
      attendees: (e.attendees ?? [])
        // A declined attendee did not meet you.
        .filter((a) => a.responseStatus !== 'declined')
        .map((a) => ({ email: a.email?.toLowerCase() ?? null, displayName: a.displayName ?? null })),
    }))
}
