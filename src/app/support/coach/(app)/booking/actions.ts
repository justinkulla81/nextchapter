'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { captureServerEvent } from '@/lib/posthog/server'
import { cancelBooking, saveBookingConfig, type CoachBookingConfig } from '@/lib/coach/booking/service'
import type { AvailabilityWindow } from '@/lib/coach/booking/slots'

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
  return { message: 'Cancelled. Your client has been told.' }
}
