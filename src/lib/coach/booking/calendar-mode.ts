import 'server-only'
import { prisma } from '@/lib/prisma'
import { coachGoogleEnabled } from '@/lib/coach/google/config'
import { CoachGoogleError } from '@/lib/coach/google/connection'
import { queryCoachBusy } from '@/lib/coach/google/calendar'
import { withoutInterval } from '@/lib/coach/google/freebusy'
import type { BusyInterval } from '@/lib/coach/booking/slots'

/**
 * Which calendar decides when a coach is free.
 * shared: the original flow (feature off, or this coach never connected): only NextChapter bookings block time and the event goes on the shared calendar.
 * coach: the coach's own Google Calendar, with its busy time already read.
 * paused: the coach's Google access was lost, so no new booking is offered or accepted (existing sessions are untouched).
 * unreadable: Google could not be reached this time. Fail closed: offering a time we could not check would defeat the point.
 */
export type CalendarMode =
  | { kind: 'shared' }
  | { kind: 'coach'; busy: BusyInterval[] }
  | { kind: 'paused' }
  | { kind: 'unreadable' }

const DAY_MS = 24 * 60 * 60 * 1000

export async function resolveCalendarMode(input: { coachId: string; now: Date; maxDaysAhead: number; ignoreInterval?: BusyInterval | null }): Promise<CalendarMode> {
  if (!coachGoogleEnabled()) return { kind: 'shared' }
  let status: string | null
  try {
    const row = await prisma.coachGoogleConnection.findUnique({ where: { coachId: input.coachId }, select: { status: true } })
    status = row?.status ?? null
  } catch (error) {
    // The table is not there yet (SQL not applied): behave as if the feature were off rather than break booking.
    console.error('Coach Google connection unreadable, using the shared calendar:', error)
    return { kind: 'shared' }
  }
  if (status === null) return { kind: 'shared' }
  if (status !== 'connected') return { kind: 'paused' }

  try {
    const { busy, failedCalendars } = await queryCoachBusy(input.coachId, input.now, new Date(input.now.getTime() + (input.maxDaysAhead + 2) * DAY_MS))
    if (failedCalendars.length > 0) return { kind: 'unreadable' }
    return { kind: 'coach', busy: withoutInterval(busy, input.ignoreInterval ?? null) }
  } catch (error) {
    if (error instanceof CoachGoogleError && error.kind === 'disconnected') return { kind: 'paused' }
    return { kind: 'unreadable' }
  }
}

export const CALENDAR_MODE_MESSAGE = {
  paused: 'This coach is not taking new bookings right now. Send them a message to set up a time.',
  unreadable: 'We could not check your coach’s calendar just now, so no times are shown. Try again in a minute.',
} as const
