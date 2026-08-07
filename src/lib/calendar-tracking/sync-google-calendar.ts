import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './google-calendar-oauth'
import { classifyCalendarEvent } from './classify-event'
import { matchRecruiterRoleMention, matchHiringManagerRoleMention, matchCoachRoleMention } from '@/lib/text/recruiter-role'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { upsertContactFromSignal } from '@/lib/network/upsert-contact-from-signal'
import type { CalendarConnection, RelationshipTag } from '@prisma/client'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
const FIRST_SYNC_WINDOW_DAYS = 30 // first-ever sync is bounded, not full calendar history

interface GoogleCalendarAttendee {
  self?: boolean
  responseStatus?: string
  email?: string
  displayName?: string
}
interface GoogleCalendarEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: GoogleCalendarAttendee[]
  recurringEventId?: string // present on every instance of a recurring event (singleEvents=true still sets this)
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
  LEARNING: 'LEARNING_SESSION_ATTENDED',
}

function eventActionLabel(eventType: string): string {
  if (eventType === 'INTERVIEW') return 'Attended an interview'
  if (eventType === 'LEARNING') return 'Attended a learning session'
  return 'Had a networking call'
}

// Only wired for NETWORKING_CALL/INTERVIEW at high confidence — a
// misclassified NEEDS_REVIEW event would otherwise pollute the candidate's
// network list with strangers from an ordinary team meeting.
const ATTENDEE_IMPORT_EVENT_TYPES = new Set(['NETWORKING_CALL', 'INTERVIEW'])

// Adds/enriches SupportNetworkContact rows for the other people on a
// networking call or interview. Never overwrites a candidate-confirmed
// `company` or existing relationshipTags — only fills gaps (inferred hints,
// and adding FORMER_COLLEAGUE when the domain-guessed company matches a
// past employer, which a candidate can always uncheck).
async function addAttendeesToNetwork(
  candidateId: string,
  attendees: GoogleCalendarAttendee[],
  autoTags: RelationshipTag[],
  workHistoryCompanies: string[]
): Promise<void> {
  const others = attendees.filter((a) => !a.self && a.email)

  for (const attendee of others) {
    const email = attendee.email!.toLowerCase()
    const name = attendee.displayName?.trim() || email.split('@')[0]
    await upsertContactFromSignal(candidateId, {
      email,
      name,
      source: 'CALENDAR_IMPORT',
      autoTags,
      workHistoryCompanies,
    })
  }
}

async function processEvent(
  connection: CalendarConnection,
  event: GoogleCalendarEvent,
  workHistoryCompanies: string[]
): Promise<boolean> {
  if (event.status === 'cancelled') return false
  if (!event.start?.dateTime) return false // all-day events carry no real "meeting happened" signal
  if (candidateDeclined(event)) return false
  const attendeeCount = event.attendees?.length ?? 0
  if (attendeeCount < 2) return false // needs at least one other invitee besides the candidate

  const title = event.summary ?? ''
  const description = event.description ?? ''
  const location = event.location ?? ''
  // The encoded-offset hour (not a Date().getHours() call, which would use
  // the server's own timezone) — Google returns dateTime with the
  // calendar's own local offset baked in, e.g. "2026-08-04T17:00:00-04:00",
  // so slicing the literal hour digits gives the organizer's local time
  // regardless of what timezone this server runs in.
  const startHour = event.start.dateTime ? Number(event.start.dateTime.slice(11, 13)) : null
  // Weekday from the date portion pinned to noon UTC — reading getDay() off
  // a plain `new Date(dateTime)` would use the server's own timezone and
  // could shift the day near midnight; noon UTC stays inside the same
  // calendar day for any realistic offset.
  const isWeekday = event.start.dateTime
    ? (() => {
        const day = new Date(`${event.start!.dateTime!.slice(0, 10)}T12:00:00Z`).getUTCDay()
        return day >= 1 && day <= 5
      })()
    : null
  const durationMinutes =
    event.start.dateTime && event.end?.dateTime
      ? Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000)
      : null
  const classification = classifyCalendarEvent(title, description, location, {
    durationMinutes,
    startHour,
    isWeekday,
    isRecurring: Boolean(event.recurringEventId),
  })
  const eventText = `${title} ${description}`
  const isRecruiterContact = matchRecruiterRoleMention(eventText)
  const isHiringManagerContact = matchHiringManagerRoleMention(eventText)
  const isCoachContact = matchCoachRoleMention(eventText)

  await prisma.trackedCalendarEvent.create({
    data: {
      candidateId: connection.candidateId,
      connectionId: connection.id,
      externalEventId: event.id,
      eventType: classification.eventType,
      confidence: classification.confidence,
      title,
      durationMinutes,
      isRecruiterContact,
      startTime: new Date(event.start.dateTime),
    },
  })

  // Points only for high-confidence classified events — never for
  // NEEDS_REVIEW or NOT_JOB_SEARCH (don't guess, don't credit personal time).
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

    if (ATTENDEE_IMPORT_EVENT_TYPES.has(classification.eventType) && event.attendees) {
      const autoTags: RelationshipTag[] = []
      if (isRecruiterContact) autoTags.push('RECRUITER')
      if (isHiringManagerContact) autoTags.push('HIRING_MANAGER')
      if (isCoachContact) autoTags.push('COACH')
      await addAttendeesToNetwork(connection.candidateId, event.attendees, autoTags, workHistoryCompanies).catch(
        (error) => console.error('Failed to add calendar attendees to network list:', error)
      )
    }
  }

  captureServerEvent(connection.candidateId, 'calendar_event_detected', {
    eventType: classification.eventType,
    confidence: classification.confidence,
    isRecruiterContact,
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

  // Same batched-existence-check pattern as sync-gmail.ts — one query
  // instead of one findUnique per event.
  const existing = await prisma.trackedCalendarEvent.findMany({
    where: { connectionId: connection.id, externalEventId: { in: events.map((e) => e.id) } },
    select: { externalEventId: true },
  })
  const existingIds = new Set(existing.map((e) => e.externalEventId))
  const newEvents = events.filter((e) => !existingIds.has(e.id))

  // Fetched once per sync, not once per event — feeds the FORMER_COLLEAGUE
  // auto-tag when a networking-call/interview attendee's email domain
  // matches a past employer.
  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId: connection.candidateId },
    select: { companyName: true },
  })
  const workHistoryCompanies = workHistory.map((w) => w.companyName)

  let synced = 0
  for (const event of newEvents) {
    if (await processEvent(connection, event, workHistoryCompanies)) synced++
  }

  await prisma.calendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date() } })
  return { synced }
}
