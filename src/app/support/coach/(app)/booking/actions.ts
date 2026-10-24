'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { captureServerEvent } from '@/lib/posthog/server'
import { cancelBooking, saveBookingConfig, type CoachBookingConfig } from '@/lib/coach/booking/service'
import type { AvailabilityWindow } from '@/lib/coach/booking/slots'
import { disconnectCoachGoogle, getCoachGoogleStatus, setConflictCalendars } from '@/lib/coach/google/connection'
import { queryCoachBusy } from '@/lib/coach/google/calendar'
import { coachGoogleEnabled, isValidCalendarId } from '@/lib/coach/google/config'

export type CoachBookingState = { error?: string; message?: string } | undefined

function intField(formData: FormData, name: string): number {
  return Number.parseInt(String(formData.get(name) ?? ''), 10)
}

export async function saveBookingSettings(_prev: CoachBookingState, formData: FormData): Promise<CoachBookingState> {
  const coach = await getCurrentCoach()

  // One row per weekday: a checkbox plus a start and end time.
  const windows: AvailabilityWindow[] = []
  for (let weekday = 0; weekday <= 6; weekday++) {
    if (formData.get(`day-${weekday}`) !== 'on') continue
    windows.push({ weekday, startMinute: intField(formData, `start-${weekday}`), endMinute: intField(formData, `end-${weekday}`) })
  }

  const config: CoachBookingConfig = {
    enabled: formData.get('enabled') === 'on',
    timezone: String(formData.get('timezone') ?? '').trim(),
    slotMinutes: intField(formData, 'slotMinutes'),
    bufferMinutes: intField(formData, 'bufferMinutes'),
    minNoticeHours: intField(formData, 'minNoticeHours'),
    maxDaysAhead: intField(formData, 'maxDaysAhead'),
    fallbackMeetingUrl: String(formData.get('fallbackMeetingUrl') ?? '').trim() || null,
  }

  const result = await saveBookingConfig(coach.id, config, windows)
  if (!result.ok) return { error: result.error }

  captureServerEvent(coach.id, 'coach_booking_settings_saved', {
    coachId: coach.id,
    enabled: config.enabled,
    slotMinutes: config.slotMinutes,
    weekdaysOpen: windows.length,
    hasFallbackUrl: config.fallbackMeetingUrl !== null,
  })
  revalidatePath('/support/coach/booking')
  return { message: config.enabled ? 'Saved. Your clients can now book the times you set.' : 'Saved. Booking is off, so clients cannot book yet.' }
}

export async function cancelCoachSession(_prev: CoachBookingState, formData: FormData): Promise<CoachBookingState> {
  const coach = await getCurrentCoach()
  const bookingId = String(formData.get('bookingId') ?? '')
  const result = await cancelBooking({ bookingId, by: 'COACH', coachId: coach.id })
  if (!result.ok) return { error: result.error }
  captureServerEvent(coach.id, 'coach_session_cancelled', { bookingId, coachId: coach.id, candidateId: result.candidateId, by: 'COACH' })
  revalidatePath('/support/coach/booking')
  return {
    message: result.calendarWarning
      ? 'Cancelled and your client has been told. We could not remove the calendar invitation, so please delete it from your Google Calendar.'
      : 'Cancelled. Your client has been told.',
  }
}

const MAX_CONFLICT_CALENDARS = 10

export async function disconnectCoachGoogleCalendar(_prev: CoachBookingState): Promise<CoachBookingState> {
  const coach = await getCurrentCoach()
  if (!coachGoogleEnabled()) return { error: 'Google Calendar connection is not available yet.' }
  await disconnectCoachGoogle(coach.id)
  revalidatePath('/support/coach/booking')
  return { message: 'Disconnected. New bookings are paused until you connect again. Your booked sessions and their Meet links stay as they are.' }
}

/** Adds a calendar to the ones checked for busy time. Google must be able to answer for it, so a typo is caught here, not silently read as free. */
export async function addConflictCalendar(_prev: CoachBookingState, formData: FormData): Promise<CoachBookingState> {
  const coach = await getCurrentCoach()
  const id = String(formData.get('calendarId') ?? '').trim()
  if (!isValidCalendarId(id)) return { error: 'Enter the calendar’s address, like name@group.calendar.google.com or an email address.' }
  const status = await getCoachGoogleStatus(coach.id)
  if (status.feature !== 'on' || status.state !== 'connected') return { error: 'Connect your Google Calendar first.' }
  if (status.calendarIds.includes(id)) return { error: 'That calendar is already checked.' }
  if (status.calendarIds.length >= MAX_CONFLICT_CALENDARS) return { error: `You can check up to ${MAX_CONFLICT_CALENDARS} calendars. Remove one first.` }
  try {
    const now = new Date()
    const { failedCalendars } = await queryCoachBusy(coach.id, now, new Date(now.getTime() + 24 * 3_600_000), [id])
    if (failedCalendars.length > 0) return { error: `We cannot see that calendar. Check the address, and that it is shared with ${status.email} so it shows when you are busy.` }
  } catch {
    return { error: 'We could not reach Google just now. Try again in a minute.' }
  }
  await setConflictCalendars(coach.id, [...status.calendarIds, id])
  captureServerEvent(coach.id, 'coach_google_calendar_added', { coachId: coach.id, calendarCount: status.calendarIds.length + 1 })
  revalidatePath('/support/coach/booking')
  return { message: 'Added. Times are only offered when none of your calendars show you busy.' }
}

export async function removeConflictCalendar(_prev: CoachBookingState, formData: FormData): Promise<CoachBookingState> {
  const coach = await getCurrentCoach()
  const id = String(formData.get('calendarId') ?? '')
  const status = await getCoachGoogleStatus(coach.id)
  if (status.feature !== 'on' || status.state !== 'connected') return { error: 'Connect your Google Calendar first.' }
  if (status.calendarIds.length <= 1) return { error: 'At least one calendar has to be checked. Add another before removing this one.' }
  await setConflictCalendars(coach.id, status.calendarIds.filter((c) => c !== id))
  captureServerEvent(coach.id, 'coach_google_calendar_removed', { coachId: coach.id, calendarCount: status.calendarIds.length - 1 })
  revalidatePath('/support/coach/booking')
  return { message: 'Removed. That calendar is no longer checked for conflicts.' }
}
