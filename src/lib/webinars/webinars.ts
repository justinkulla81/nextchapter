import 'server-only'
import { prisma } from '@/lib/prisma'
import { getValidAdminAccessToken } from './admin-calendar-oauth'
import { getCurrentWeekSprint, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'

const CALENDAR_INSERT_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'

interface CreateWebinarInput {
  title: string
  description: string | null
  hostLabel: string
  scheduledAt: Date
  durationMinutes: number
}

// Creates the Webinar row AND the underlying Google Calendar event with an
// auto-generated Meet link (conferenceData, no separate Meet API call
// needed). If the admin Calendar connection doesn't exist or the Calendar
// call fails, the Webinar row is still created (visible to admin, editable)
// but meetLink stays null — admin can see it needs attention rather than
// the whole creation silently failing.
export async function createWebinar(input: CreateWebinarInput) {
  const webinar = await prisma.webinar.create({
    data: {
      title: input.title,
      description: input.description,
      hostLabel: input.hostLabel,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
    },
  })

  try {
    const accessToken = await getValidAdminAccessToken()
    const startIso = input.scheduledAt.toISOString()
    const endIso = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60_000).toISOString()

    const response = await fetch(CALENDAR_INSERT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.title,
        description: input.description ?? undefined,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        conferenceData: {
          createRequest: {
            requestId: webinar.id,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    })

    if (!response.ok) {
      console.error('Failed to create webinar Calendar event:', response.status, await response.text())
      return webinar
    }

    const event = await response.json()
    const meetLink: string | undefined = event.hangoutLink
    if (meetLink) {
      return prisma.webinar.update({
        where: { id: webinar.id },
        data: { meetLink, googleEventId: event.id },
      })
    }
    return webinar
  } catch (error) {
    console.error('Failed to connect webinar to Google Calendar:', error)
    return webinar
  }
}

// candidateId optional — same admin-vs-candidate personalization pattern as
// getCarouselVideos/getCarouselPodcasts (src/lib/content/curated-content.ts).
// Webinars have no "author" concept, so only individual dislikes are
// filtered, same as podcasts.
export async function getUpcomingWebinars(candidateId?: string) {
  const webinars = await prisma.webinar.findMany({
    where: { cancelledAt: null, scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
  })
  if (!candidateId) return webinars

  const dislikes = await prisma.contentDislike.findMany({
    where: { candidateId, contentType: 'WEBINAR' },
    select: { contentId: true },
  })
  const dislikedIds = new Set(dislikes.map((d) => d.contentId))
  return webinars.filter((w) => !dislikedIds.has(w.id))
}

// Registration itself is the verified, real action credited here — not a
// self-reported "I attended" (see SprintActionCompletion's own move away
// from self-report buttons). ENGAGE_EVENT already exists as "attend a
// community event or session" at a moderate 30-point weight; reused as-is
// rather than adding a new action type for what's functionally the same
// signal.
export async function registerForWebinar(webinarId: string, candidateId: string) {
  const registration = await prisma.webinarRegistration.upsert({
    where: { webinarId_candidateId: { webinarId, candidateId } },
    create: { webinarId, candidateId },
    update: {},
  })

  const sprint = await getCurrentWeekSprint(candidateId)
  if (sprint) {
    const effort = estimateActionEffort({ actionType: 'ENGAGE_EVENT' })
    await logCatalogAction(candidateId, {
      text: 'Registered for a NextChapter webinar',
      actionType: 'ENGAGE_EVENT',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: true,
    }).catch((error) => console.error('Failed to log webinar registration action:', error))
  }

  captureServerEvent(candidateId, 'webinar_registered', { webinarId })
  return registration
}

export async function getCandidateWebinarRegistrations(candidateId: string) {
  const registrations = await prisma.webinarRegistration.findMany({
    where: { candidateId },
    select: { webinarId: true },
  })
  return new Set(registrations.map((r) => r.webinarId))
}
