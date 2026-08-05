import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './google-calendar-oauth'
import { classifyCalendarEvent } from './classify-event'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CalendarConnection } from '@prisma/client'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
const FIRST_SYNC_WINDOW_DAYS = 30 // first-ever sync is bounded, not full calendar history

interface GoogleCalendarAttendee {
  self?: boolean
  responseStatus?: string
}
interface GoogleCalendarEvent {
  id: string
  status?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: GoogleCalendarAttendee[]
}

// Testing-mode refresh tokens expire ~7 days after issue — a refresh
// failure here is expected, not a bug. Turns into a candidate-facing
// reconnect prompt (needsReconnectAt), never a silent failure. Mirrors
// sync-gmail.ts's ensureFreshAccessToken exactly.
async function ensureFreshAccessToken(connection: CalendarConnection): Promise<string | null> {
  const bufferMs = 2 * 60 * 1000
  if (connection.expiresAt.getTime() - bufferMs > Date.now()) {
    return connection.accessToken
  }
  try {
    const tokens = await refreshAccessToken(connection.refreshToken)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { accessToken: tokens.access_token, expiresAt, needsReconnectAt: null },
    })
    return tokens.access_token
  } catch (error) {
    console.error('Calendar token refresh failed — flagging for reconnect:', error)
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { needsReconnectAt: new Date() },
    })
    return null
  }
}

async function listPastEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  })
  const response = await fetch(`${CALENDAR_API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return []
  const data = (await response.json()) as { items?: GoogleCalendarEvent[] }
  return data.items ?? []
}

// A real "attended" signal requires another person invited and not declined
// by the candidate — a solo calendar block (focus time, a personal
// reminder) is never classified, no matter what the title says.
function candidateDeclined(event: GoogleCalendarEvent): boolean {
  const self = event.attendees?.find((a) => a.self)
  return self?.responseStatus === 'declined'
}

const ACTION_TYPE_BY_EVENT_TYPE: Partial<Record<string, string>> = {
  INTERVIEW: 'INTERVIEW_ATTENDED',
  NETWORKING_CALL: 'OUTREACH_CALL',
}

function eventActionLabel(eventType: string): string {
  return eventType === 'INTERVIEW' ? 'Attended an interview' : 'Had a networking call'
}

async function processEvent(connection: CalendarConnection, event: GoogleCalendarEvent): Promise<boolean> {
  if (event.status === 'cancelled') return false
  if (!event.start?.dateTime) return false // all-day events carry no real "meeting happened" signal
  if (candidateDeclined(event)) return false
  const attendeeCount = event.attendees?.length ?? 0
  if (attendeeCount < 2) return false // needs at least one other invitee besides the candidate

  const existing = await prisma.trackedCalendarEvent.findUnique({
    where: { connectionId_externalEventId: { connectionId: connection.id, externalEventId: event.id } },
  })
  if (existing) return false

  const title = event.summary ?? ''
  // The encoded-offset hour (not a Date().getHours() call, which would use
  // the server's own timezone) — Google returns dateTime with the
  // calendar's own local offset baked in, e.g. "2026-08-04T17:00:00-04:00",
  // so slicing the literal hour digits gives the organizer's local time
  // regardless of what timezone this server runs in.
  const startHour = event.start.dateTime ? Number(event.start.dateTime.slice(11, 13)) : null
  const durationMinutes =
    event.start.dateTime && event.end?.dateTime
      ? Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000)
      : null
  const classification = classifyCalendarEvent(title, { durationMinutes, startHour })

  await prisma.trackedCalendarEvent.create({
    data: {
      candidateId: connection.candidateId,
      connectionId: connection.id,
      externalEventId: event.id,
      eventType: classification.eventType,
      confidence: classification.confidence,
      title,
      startTime: new Date(event.start.dateTime),
    },
  })

  // Points only for high-confidence classified events — never for
  // NEEDS_REVIEW (don't guess).
  if (classification.confidence === 'high') {
    const actionType = ACTION_TYPE_BY_EVENT_TYPE[classification.eventType]
    if (actionType) {
      const effort = estimateActionEffort({ actionType })
      await autoCompleteEngagementAction(connection.candidateId, {
        actionType,
        text: eventActionLabel(classification.eventType),
        points: effort.points,
        estimatedMinutes: effort.minutes,
      }).catch((error) => console.error('Failed to auto-complete calendar-detected action:', error))
    }
  }

  captureServerEvent(connection.candidateId, 'calendar_event_detected', {
    eventType: classification.eventType,
    confidence: classification.confidence,
  })

  return true
}

export async function syncGoogleCalendarConnection(connectionId: string): Promise<{ synced: number } | null> {
  const connection = await prisma.calendarConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.disconnectedAt) return null

  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < THROTTLE_MS) {
    return { synced: 0 }
  }

  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return null

  const timeMin = connection.lastSyncAt ?? new Date(Date.now() - FIRST_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  // Only events that have already happened are a real "attended" signal —
  // never award points for a meeting still on the calendar.
  const timeMax = new Date()

  const events = await listPastEvents(accessToken, timeMin, timeMax)

  let synced = 0
  for (const event of events) {
    if (await processEvent(connection, event)) synced++
  }

  await prisma.calendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date() } })
  return { synced }
}
