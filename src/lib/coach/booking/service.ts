import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createMeetEvent, deleteCalendarEvent, moveCalendarEvent } from '@/lib/google/calendar-event'
import { createCoachMeetEvent, deleteCoachEvent, moveCoachEvent } from '@/lib/coach/google/calendar'
import { CALENDAR_MODE_MESSAGE, resolveCalendarMode } from '@/lib/coach/booking/calendar-mode'
import { sendBookingEmail } from '@/lib/email/send-coach-booking'
import {
  generateSlots,
  isOpenSlot,
  isValidTimeZone,
  SLOT_MINUTE_CHOICES,
  type AvailabilityWindow,
  type BookingSettings,
  type BusyInterval,
} from '@/lib/coach/booking/slots'

export interface CoachBookingConfig extends BookingSettings {
  enabled: boolean
  fallbackMeetingUrl: string | null
}

export const DEFAULT_BOOKING_CONFIG: CoachBookingConfig = {
  enabled: false,
  timezone: 'America/New_York',
  slotMinutes: 45,
  bufferMinutes: 15,
  minNoticeHours: 24,
  maxDaysAhead: 21,
  fallbackMeetingUrl: null,
}

const MAX_UPCOMING_PER_CANDIDATE = 3
const MAX_WINDOWS = 21

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export async function getBookingConfig(coachId: string): Promise<{ config: CoachBookingConfig; windows: AvailabilityWindow[] }> {
  const [row, windows] = await Promise.all([
    prisma.coachBookingSettings.findUnique({ where: { coachId } }),
    prisma.coachAvailabilityWindow.findMany({ where: { coachId }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] }),
  ])
  const config: CoachBookingConfig = row
    ? {
        enabled: row.enabled,
        timezone: row.timezone,
        slotMinutes: row.slotMinutes,
        bufferMinutes: row.bufferMinutes,
        minNoticeHours: row.minNoticeHours,
        maxDaysAhead: row.maxDaysAhead,
        fallbackMeetingUrl: row.fallbackMeetingUrl,
      }
    : DEFAULT_BOOKING_CONFIG
  return { config, windows: windows.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })) }
}

export function validateBookingConfig(config: CoachBookingConfig, windows: AvailabilityWindow[]): string | null {
  if (!isValidTimeZone(config.timezone)) return 'Pick your time zone from the list.'
  if (!(SLOT_MINUTE_CHOICES as readonly number[]).includes(config.slotMinutes)) return 'Pick a session length of 30, 45 or 60 minutes.'
  if (!Number.isInteger(config.bufferMinutes) || config.bufferMinutes < 0 || config.bufferMinutes > 120) return 'Time between sessions must be between 0 and 120 minutes.'
  if (!Number.isInteger(config.minNoticeHours) || config.minNoticeHours < 0 || config.minNoticeHours > 24 * 14) return 'Minimum notice must be between 0 hours and 14 days.'
  if (!Number.isInteger(config.maxDaysAhead) || config.maxDaysAhead < 1 || config.maxDaysAhead > 90) return 'Clients can book between 1 and 90 days ahead.'
  if (config.fallbackMeetingUrl && !/^https:\/\/\S+$/i.test(config.fallbackMeetingUrl)) return 'Your meeting link should start with https://.'
  if (windows.length > MAX_WINDOWS) return 'That is more weekly hours than we can keep. Remove some.'
  for (const w of windows) {
    if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6) return 'One of the days is not valid. Reload the page and try again.'
    if (!Number.isInteger(w.startMinute) || !Number.isInteger(w.endMinute) || w.startMinute < 0 || w.endMinute > 24 * 60) return 'One of the times is not valid. Reload the page and try again.'
    if (w.endMinute <= w.startMinute) return 'Each day’s end time has to be after its start time.'
    if (w.endMinute - w.startMinute < config.slotMinutes) return `A day’s hours must be at least one ${config.slotMinutes}-minute session long.`
  }
  if (config.enabled && windows.length === 0) return 'Add at least one day of hours before you turn booking on.'
  return null
}

export async function saveBookingConfig(coachId: string, config: CoachBookingConfig, windows: AvailabilityWindow[]): Promise<Result> {
  const problem = validateBookingConfig(config, windows)
  if (problem) return { ok: false, error: problem }
  const data = {
    enabled: config.enabled,
    timezone: config.timezone,
    slotMinutes: config.slotMinutes,
    bufferMinutes: config.bufferMinutes,
    minNoticeHours: config.minNoticeHours,
    maxDaysAhead: config.maxDaysAhead,
    fallbackMeetingUrl: config.fallbackMeetingUrl,
  }
  await prisma.$transaction([
    prisma.coachBookingSettings.upsert({ where: { coachId }, create: { coachId, ...data }, update: data }),
    prisma.coachAvailabilityWindow.deleteMany({ where: { coachId } }),
    prisma.coachAvailabilityWindow.createMany({ data: windows.map((w) => ({ coachId, ...w })) }),
  ])
  return { ok: true }
}

/**
 * Everything the booking page needs in one load: the coach's settings and the slots open right now.
 * Slots are only worked out when booking is on and hours are set, so a coach who has not opened their
 * calendar costs no booking query. When the coach connected their own Google Calendar, times that calendar shows
 * as busy are left out; if that calendar cannot be read, no times are offered and `calendar` says why.
 */
export async function loadBookingView(coachId: string, now = new Date()): Promise<{ config: CoachBookingConfig; slots: Date[]; calendar: 'shared' | 'coach' | 'paused' | 'unreadable' }> {
  const { config, windows } = await getBookingConfig(coachId)
  if (!config.enabled || windows.length === 0) return { config, slots: [], calendar: 'shared' }
  const [busy, mode] = await Promise.all([
    prisma.coachBooking.findMany({
      where: { coachId, status: 'CONFIRMED', endsAt: { gte: now } },
      select: { startsAt: true, endsAt: true },
    }),
    resolveCalendarMode({ coachId, now, maxDaysAhead: config.maxDaysAhead }),
  ])
  if (mode.kind === 'paused' || mode.kind === 'unreadable') return { config, slots: [], calendar: mode.kind }
  const allBusy: BusyInterval[] = mode.kind === 'coach' ? [...busy, ...mode.busy] : busy
  return { config, slots: generateSlots({ settings: config, windows, busy: allBusy, now }), calendar: mode.kind }
}

/**
 * Books a slot for one of the coach's own clients. Two people choosing the same time must
 * not both get it, so the check and the insert happen together under a per-coach lock.
 * The calendar event is made after, outside the lock, because it is a network call that can
 * be slow or unavailable; the booking stands either way.
 */
export async function bookSlot(input: { coachId: string; candidateId: string; startsAt: Date }): Promise<Result<{ bookingId: string; meetUrl: string | null; calendar: 'coach' | 'shared' }>> {
  const now = new Date()
  const candidate = await prisma.candidateProfile.findFirst({
    where: { id: input.candidateId, coachId: input.coachId },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  if (!candidate) return { ok: false, error: 'You can only book with the coach you are working with.' }

  const upcoming = await prisma.coachBooking.count({ where: { candidateId: input.candidateId, status: 'CONFIRMED', startsAt: { gte: now } } })
  if (upcoming >= MAX_UPCOMING_PER_CANDIDATE) {
    return { ok: false, error: `You already have ${MAX_UPCOMING_PER_CANDIDATE} sessions booked. Cancel one, or book again after one has happened.` }
  }

  // Google is asked before the lock is taken: a network call must not hold the per-coach lock open.
  const preSettings = await prisma.coachBookingSettings.findUnique({ where: { coachId: input.coachId }, select: { enabled: true, maxDaysAhead: true } })
  if (!preSettings?.enabled) return { ok: false, error: 'This coach is not taking bookings right now.' }
  const mode = await resolveCalendarMode({ coachId: input.coachId, now, maxDaysAhead: preSettings.maxDaysAhead })
  if (mode.kind === 'paused' || mode.kind === 'unreadable') return { ok: false, error: CALENDAR_MODE_MESSAGE[mode.kind] }
  const calendarBusy = mode.kind === 'coach' ? mode.busy : []

  const booked = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.coachId}))`)
      const settings = await tx.coachBookingSettings.findUnique({ where: { coachId: input.coachId } })
      if (!settings?.enabled) return { error: 'This coach is not taking bookings right now.' as const }
      const [windows, busy] = await Promise.all([
        tx.coachAvailabilityWindow.findMany({ where: { coachId: input.coachId } }),
        tx.coachBooking.findMany({ where: { coachId: input.coachId, status: 'CONFIRMED', endsAt: { gte: now } }, select: { startsAt: true, endsAt: true } }),
      ])
      const ok = isOpenSlot(input.startsAt, {
        settings: { timezone: settings.timezone, slotMinutes: settings.slotMinutes, bufferMinutes: settings.bufferMinutes, minNoticeHours: settings.minNoticeHours, maxDaysAhead: settings.maxDaysAhead },
        windows: windows.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })),
        busy: [...busy, ...calendarBusy],
        now,
      })
      if (!ok) return { error: 'That time was just taken or is no longer open. Pick another time.' as const }
      const endsAt = new Date(input.startsAt.getTime() + settings.slotMinutes * 60_000)
      const booking = await tx.coachBooking.create({
        data: { coachId: input.coachId, candidateId: input.candidateId, startsAt: input.startsAt, endsAt, meetUrl: settings.fallbackMeetingUrl },
      })
      return { booking, settings }
    },
    { timeout: 15_000 }
  )
  if (booked.error !== undefined) return { ok: false, error: booked.error }

  const { booking, settings } = booked
  // The booking is committed. Everything below is best-effort: a failure here must not turn a
  // successful booking into an error (which would invite a retry that then says the time is taken).
  let meetUrl: string | null = settings.fallbackMeetingUrl
  try {
    const coach = await prisma.coach.findUniqueOrThrow({ where: { id: input.coachId }, select: { fullName: true, workEmail: true } })
    const clientName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'your client'
    const attendees = [coach.workEmail, candidate.email].filter((e): e is string => Boolean(e))

    const summary = `Coaching session: ${coach.fullName} and ${clientName}`
    const description = 'A NextChapter coaching session. To change or cancel it, use your NextChapter dashboard.'
    let event: { eventId: string; meetUrl: string | null; calendarId: string | null } | null = null
    if (mode.kind === 'coach') {
      // On the coach's own calendar they are the organizer, so only the client is a guest.
      event = await createCoachMeetEvent(input.coachId, {
        summary,
        description,
        start: booking.startsAt,
        end: booking.endsAt,
        attendeeEmails: candidate.email ? [candidate.email] : [],
        bookingId: booking.id,
      }).catch((error) => {
        console.error(`Booking ${booking.id}: the coach's calendar did not take the event:`, error)
        return null
      })
    } else {
      const shared = await createMeetEvent({ summary, description, start: booking.startsAt, end: booking.endsAt, attendeeEmails: attendees, requestId: booking.id })
      event = shared ? { eventId: shared.eventId, meetUrl: shared.meetUrl, calendarId: null } : null
    }
    meetUrl = event?.meetUrl ?? settings.fallbackMeetingUrl
    if (event) {
      try {
        await prisma.coachBooking.update({ where: { id: booking.id }, data: { googleEventId: event.eventId, googleCalendarId: event.calendarId, meetUrl } })
      } catch (error) {
        // Without the event id a later cancel cannot remove the calendar event. Log loudly so it can be cleaned up by hand.
        console.error(`Booking ${booking.id} created calendar event ${event.eventId} but could not store it:`, error)
      }
    }

    // Google already emailed an invitation when the event was made; otherwise send our own.
    if (!event) {
      const detail = { startsAt: booking.startsAt, timezone: settings.timezone, meetUrl }
      if (candidate.email) await sendBookingEmail({ to: candidate.email, kind: 'booked', otherPartyName: coach.fullName, ...detail })
      await sendBookingEmail({ to: coach.workEmail, audience: 'coach', kind: 'booked', otherPartyName: clientName, ...detail })
    }
  } catch (error) {
    console.error(`Booking ${booking.id} was saved but its calendar event or email failed:`, error)
  }
  return { ok: true, bookingId: booking.id, meetUrl, calendar: mode.kind === 'coach' ? ('coach' as const) : ('shared' as const) }
}

export async function cancelBooking(input: { bookingId: string; by: 'COACH' | 'CANDIDATE'; coachId?: string; candidateId?: string }): Promise<Result<{ coachId: string; candidateId: string; calendarWarning: boolean }>> {
  const booking = await prisma.coachBooking.findFirst({
    where: {
      id: input.bookingId,
      ...(input.by === 'COACH' ? { coachId: input.coachId ?? '' } : { candidateId: input.candidateId ?? '' }),
    },
    include: { coach: { select: { fullName: true, workEmail: true } }, candidate: { select: { email: true, firstName: true, lastName: true } } },
  })
  if (!booking) return { ok: false, error: 'We could not find this session. Reload the page and try again.' }
  if (booking.status !== 'CONFIRMED') return { ok: false, error: 'This session was already cancelled.' }
  if (booking.startsAt.getTime() < Date.now()) return { ok: false, error: 'This session has already happened, so it cannot be cancelled.' }

  // Only one of two people cancelling at the same moment gets to do the follow-up work.
  const claimed = await prisma.coachBooking.updateMany({ where: { id: booking.id, status: 'CONFIRMED' }, data: { status: 'CANCELLED', cancelledBy: input.by } })
  if (claimed.count === 0) return { ok: false, error: 'This session was already cancelled.' }

  let calendarWarning = false
  let removed = false
  if (booking.googleEventId) {
    // An event made on the coach's own calendar is removed with the coach's access; the original ones live on the shared calendar.
    removed = booking.googleCalendarId ? await deleteCoachEvent(booking.coachId, booking.googleCalendarId, booking.googleEventId) : await deleteCalendarEvent(booking.googleEventId)
    // The session is cancelled here either way, but if Google would not remove the event the invitation is still
    // on both calendars. Say so, so the person can delete it by hand, and log it.
    if (!removed) {
      calendarWarning = true
      console.error(`Booking ${booking.id} cancelled but calendar event ${booking.googleEventId} could not be removed.`)
    }
  }

  // Google sends its own cancellation when it removed the event; otherwise tell the other person ourselves.
  if (!removed) {
    const settings = await prisma.coachBookingSettings.findUnique({ where: { coachId: booking.coachId }, select: { timezone: true } })
    const timezone = settings?.timezone ?? DEFAULT_BOOKING_CONFIG.timezone
    const clientName = [booking.candidate.firstName, booking.candidate.lastName].filter(Boolean).join(' ') || 'Your client'
    if (input.by === 'COACH' && booking.candidate.email) {
      await sendBookingEmail({ to: booking.candidate.email, kind: 'cancelled', otherPartyName: booking.coach.fullName, startsAt: booking.startsAt, timezone, meetUrl: null })
    } else if (input.by === 'CANDIDATE') {
      await sendBookingEmail({ to: booking.coach.workEmail, audience: 'coach', kind: 'cancelled', otherPartyName: clientName, startsAt: booking.startsAt, timezone, meetUrl: null })
    }
  }
  return { ok: true, coachId: booking.coachId, candidateId: booking.candidateId, calendarWarning }
}

/**
 * Moves one confirmed session to another open time. The same rules as a new booking apply (hours, notice, buffers, the
 * coach's Google busy time), except the session being moved does not block its own new time. The calendar event is moved,
 * not recreated, so the Meet link stays. If the event cannot be moved we email both people instead.
 */
export async function rescheduleBooking(input: {
  bookingId: string
  by: 'COACH' | 'CANDIDATE'
  coachId?: string
  candidateId?: string
  newStartsAt: Date
}): Promise<Result<{ coachId: string; candidateId: string; calendarWarning: boolean }>> {
  const now = new Date()
  const booking = await prisma.coachBooking.findFirst({
    where: { id: input.bookingId, ...(input.by === 'COACH' ? { coachId: input.coachId ?? '' } : { candidateId: input.candidateId ?? '' }) },
    include: { coach: { select: { fullName: true, workEmail: true } }, candidate: { select: { email: true, firstName: true, lastName: true } } },
  })
  if (!booking) return { ok: false, error: 'We could not find this session. Reload the page and try again.' }
  if (booking.status !== 'CONFIRMED') return { ok: false, error: 'This session was cancelled, so it cannot be moved. Book a new time instead.' }
  if (booking.startsAt.getTime() < now.getTime()) return { ok: false, error: 'This session has already happened, so it cannot be moved.' }

  const preSettings = await prisma.coachBookingSettings.findUnique({ where: { coachId: booking.coachId }, select: { enabled: true, maxDaysAhead: true } })
  if (!preSettings?.enabled) return { ok: false, error: 'This coach is not taking bookings right now.' }
  const own = { startsAt: booking.startsAt, endsAt: booking.endsAt }
  const mode = await resolveCalendarMode({ coachId: booking.coachId, now, maxDaysAhead: preSettings.maxDaysAhead, ignoreInterval: own })
  if (mode.kind === 'paused' || mode.kind === 'unreadable') return { ok: false, error: CALENDAR_MODE_MESSAGE[mode.kind] }
  const calendarBusy = mode.kind === 'coach' ? mode.busy : []

  const moved = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${booking.coachId}))`)
      const settings = await tx.coachBookingSettings.findUnique({ where: { coachId: booking.coachId } })
      if (!settings?.enabled) return { error: 'This coach is not taking bookings right now.' as const }
      const [windows, busy] = await Promise.all([
        tx.coachAvailabilityWindow.findMany({ where: { coachId: booking.coachId } }),
        tx.coachBooking.findMany({ where: { coachId: booking.coachId, status: 'CONFIRMED', endsAt: { gte: now }, id: { not: booking.id } }, select: { startsAt: true, endsAt: true } }),
      ])
      const ok = isOpenSlot(input.newStartsAt, {
        settings: { timezone: settings.timezone, slotMinutes: settings.slotMinutes, bufferMinutes: settings.bufferMinutes, minNoticeHours: settings.minNoticeHours, maxDaysAhead: settings.maxDaysAhead },
        windows: windows.map((w) => ({ weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })),
        busy: [...busy, ...calendarBusy],
        now,
      })
      if (!ok) return { error: 'That time was just taken or is no longer open. Pick another time.' as const }
      const endsAt = new Date(input.newStartsAt.getTime() + settings.slotMinutes * 60_000)
      await tx.coachBooking.update({ where: { id: booking.id }, data: { startsAt: input.newStartsAt, endsAt } })
      return { endsAt, timezone: settings.timezone }
    },
    { timeout: 15_000 }
  )
  if ('error' in moved) return { ok: false, error: moved.error as string }

  let calendarWarning = false
  let eventMoved = false
  if (booking.googleEventId) {
    eventMoved = booking.googleCalendarId
      ? await moveCoachEvent(booking.coachId, booking.googleCalendarId, booking.googleEventId, input.newStartsAt, moved.endsAt)
      : await moveCalendarEvent(booking.googleEventId, input.newStartsAt, moved.endsAt)
    if (!eventMoved) {
      calendarWarning = true
      console.error(`Booking ${booking.id} moved but calendar event ${booking.googleEventId} could not be moved.`)
    }
  }
  // Google emails the guests itself when it moved the event; otherwise tell both people.
  if (!eventMoved) {
    const clientName = [booking.candidate.firstName, booking.candidate.lastName].filter(Boolean).join(' ') || 'your client'
    const detail = { kind: 'rescheduled' as const, startsAt: input.newStartsAt, timezone: moved.timezone, meetUrl: booking.meetUrl }
    if (booking.candidate.email) await sendBookingEmail({ to: booking.candidate.email, otherPartyName: booking.coach.fullName, ...detail })
    await sendBookingEmail({ to: booking.coach.workEmail, audience: 'coach', otherPartyName: clientName, ...detail })
  }
  return { ok: true, coachId: booking.coachId, candidateId: booking.candidateId, calendarWarning }
}

export async function listUpcomingForCoach(coachId: string) {
  return prisma.coachBooking.findMany({
    where: { coachId, status: 'CONFIRMED', startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 50,
    include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export async function listUpcomingForCandidate(candidateId: string) {
  return prisma.coachBooking.findMany({
    where: { candidateId, status: 'CONFIRMED', startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 10,
  })
}
