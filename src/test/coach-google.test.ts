import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Per-coach Google Calendar: free/busy slot filtering, event creation with a Meet link, disconnect handling and the
// feature-off behaviour. Google (fetch) and Prisma are mocked; nothing here reaches the network or a database.

const prismaMock = vi.hoisted(() => {
  const m = {
    coachGoogleConnection: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    coachBookingSettings: { findUnique: vi.fn() },
    coachAvailabilityWindow: { findMany: vi.fn() },
    coachBooking: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    candidateProfile: { findFirst: vi.fn() },
    coach: { findUniqueOrThrow: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m))
  return m
})
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/email/send-coach-booking', () => ({ sendBookingEmail: vi.fn(async () => ({ sent: true })) }))
vi.mock('@/lib/google/calendar-event', () => ({ createMeetEvent: vi.fn(async () => null), deleteCalendarEvent: vi.fn(async () => true), moveCalendarEvent: vi.fn(async () => true) }))
const calendarMock = vi.hoisted(() => ({ queryCoachBusy: vi.fn(), createCoachMeetEvent: vi.fn(), moveCoachEvent: vi.fn(), deleteCoachEvent: vi.fn() }))
vi.mock('@/lib/coach/google/calendar', () => calendarMock)

import { generateSlots, zonedWallTimeToInstant, type BookingSettings } from '@/lib/coach/booking/slots'
import { parseFreeBusy, withoutInterval } from '@/lib/coach/google/freebusy'
import { coachGoogleEnabled, hasRequiredScopes, isValidCalendarId, COACH_GOOGLE_SCOPES } from '@/lib/coach/google/config'
import { mintCoachOAuthState, verifyCoachOAuthState } from '@/lib/coach/google/state'
import { resolveCalendarMode } from '@/lib/coach/booking/calendar-mode'
import { bookSlot, loadBookingView } from '@/lib/coach/booking/service'
import { sendBookingEmail } from '@/lib/email/send-coach-booking'
import { createMeetEvent } from '@/lib/google/calendar-event'

const NY = 'America/New_York'
const local = (iso: string) => {
  const [d, t] = iso.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return zonedWallTimeToInstant(y, mo, da, h * 60 + mi, NY)
}
const settings: BookingSettings = { timezone: NY, slotMinutes: 60, bufferMinutes: 0, minNoticeHours: 0, maxDaysAhead: 7 }
const mondayMorning = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }]
const now = local('2026-01-11 08:00') // a Sunday

function enableFeature() {
  vi.stubEnv('COACH_GOOGLE_CLIENT_ID', 'coach-client-id')
  vi.stubEnv('COACH_GOOGLE_CLIENT_SECRET', 'coach-client-secret')
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('free/busy parsing and slot filtering', () => {
  it('turns Google’s busy blocks into intervals across every selected calendar', () => {
    const parsed = parseFreeBusy(
      {
        calendars: {
          primary: { busy: [{ start: '2026-01-12T14:00:00Z', end: '2026-01-12T15:00:00Z' }] },
          'family@group.calendar.google.com': { busy: [{ start: '2026-01-12T16:00:00Z', end: '2026-01-12T17:00:00Z' }] },
        },
      },
      ['primary', 'family@group.calendar.google.com']
    )
    expect(parsed.failedCalendars).toEqual([])
    expect(parsed.busy.map((b) => b.startsAt.toISOString())).toEqual(['2026-01-12T14:00:00.000Z', '2026-01-12T16:00:00.000Z'])
  })

  it('never reads a calendar Google would not answer for as free', () => {
    const parsed = parseFreeBusy({ calendars: { primary: { busy: [] }, 'typo@example.com': { errors: [{ reason: 'notFound' }] } } }, ['primary', 'typo@example.com', 'missing@example.com'])
    expect(parsed.failedCalendars).toEqual(['typo@example.com', 'missing@example.com'])
  })

  it('offers only free slots: a busy block removes the slots it overlaps', () => {
    const free = generateSlots({ settings, windows: mondayMorning, busy: [], now })
    expect(free).toHaveLength(3) // 9, 10, 11 on Monday January 12
    const { busy } = parseFreeBusy({ calendars: { primary: { busy: [{ start: local('2026-01-12 10:00').toISOString(), end: local('2026-01-12 11:00').toISOString() }] } } }, ['primary'])
    const open = generateSlots({ settings, windows: mondayMorning, busy, now })
    expect(open.map((s) => s.toISOString())).toEqual([local('2026-01-12 09:00').toISOString(), local('2026-01-12 11:00').toISOString()])
  })

  it('removes a slot that a partial overlap touches', () => {
    const { busy } = parseFreeBusy({ calendars: { primary: { busy: [{ start: local('2026-01-12 10:30').toISOString(), end: local('2026-01-12 11:15').toISOString() }] } } }, ['primary'])
    const open = generateSlots({ settings, windows: mondayMorning, busy, now })
    expect(open.map((s) => s.toISOString())).toEqual([local('2026-01-12 09:00').toISOString()])
  })

  it('lets a booking being moved ignore its own block only', () => {
    const own = { startsAt: local('2026-01-12 10:00'), endsAt: local('2026-01-12 11:00') }
    const other = { startsAt: local('2026-01-12 11:00'), endsAt: local('2026-01-12 12:00') }
    expect(withoutInterval([own, other], own)).toEqual([other])
    expect(withoutInterval([own, other], null)).toEqual([own, other])
  })
})

describe('configuration and state', () => {
  it('is off unless both env vars are set', () => {
    expect(coachGoogleEnabled()).toBe(false)
    vi.stubEnv('COACH_GOOGLE_CLIENT_ID', 'only-id')
    expect(coachGoogleEnabled()).toBe(false)
    vi.stubEnv('COACH_GOOGLE_CLIENT_SECRET', 'secret')
    expect(coachGoogleEnabled()).toBe(true)
  })

  it('asks Google for calendar events and free/busy only, plus openid and email', () => {
    expect([...COACH_GOOGLE_SCOPES]).toEqual(['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy', 'openid', 'email'])
    expect(COACH_GOOGLE_SCOPES.some((s) => /calendar$|calendar\.readonly|gmail|documents/.test(s))).toBe(false)
  })

  it('refuses a grant that is missing a calendar scope', () => {
    expect(hasRequiredScopes('openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy')).toBe(true)
    expect(hasRequiredScopes('openid email https://www.googleapis.com/auth/calendar.events')).toBe(false)
    expect(hasRequiredScopes(undefined)).toBe(false)
  })

  it('accepts calendar ids Google uses and rejects free text', () => {
    expect(isValidCalendarId('primary')).toBe(true)
    expect(isValidCalendarId('family@group.calendar.google.com')).toBe(true)
    expect(isValidCalendarId('my family')).toBe(false)
    expect(isValidCalendarId('')).toBe(false)
  })

  it('mints a signed state that carries the coach and rejects tampering and expiry', () => {
    enableFeature()
    const state = mintCoachOAuthState('coach_1', 1_000)
    expect(verifyCoachOAuthState(state, 1_000 + 60_000)).toEqual({ coachId: 'coach_1' })
    expect(verifyCoachOAuthState(state, 1_000 + 11 * 60_000)).toBeNull()
    const [payload, sig] = state.split('.')
    const forged = `${Buffer.from(JSON.stringify({ c: 'coach_2', x: 9_999_999_999_999, n: 'x' })).toString('base64url')}.${sig}`
    expect(verifyCoachOAuthState(forged, 2_000)).toBeNull()
    expect(verifyCoachOAuthState(`${payload}.bad`, 2_000)).toBeNull()
    expect(verifyCoachOAuthState(null)).toBeNull()
  })

  it('verifies nothing while the feature is off', () => {
    enableFeature()
    const state = mintCoachOAuthState('coach_1', 1_000)
    vi.unstubAllEnvs()
    expect(verifyCoachOAuthState(state, 2_000)).toBeNull()
  })
})

describe('feature off', () => {
  it('uses the shared-calendar flow and never touches Google or the connection table', async () => {
    const mode = await resolveCalendarMode({ coachId: 'c1', now, maxDaysAhead: 7 })
    expect(mode).toEqual({ kind: 'shared' })
    expect(prismaMock.coachGoogleConnection.findUnique).not.toHaveBeenCalled()
    expect(calendarMock.queryCoachBusy).not.toHaveBeenCalled()
  })

  it('books on the shared calendar exactly as before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    setupBooking()
    const result = await bookSlot({ coachId: 'c1', candidateId: 'm1', startsAt: local('2026-01-12 09:00') })
    expect(result).toMatchObject({ ok: true, calendar: 'shared' })
    expect(createMeetEvent).toHaveBeenCalledTimes(1)
    expect(calendarMock.createCoachMeetEvent).not.toHaveBeenCalled()
    expect(calendarMock.queryCoachBusy).not.toHaveBeenCalled()
  })

  it('treats a coach who never connected the same way even when the feature is on', async () => {
    enableFeature()
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue(null)
    expect(await resolveCalendarMode({ coachId: 'c1', now, maxDaysAhead: 7 })).toEqual({ kind: 'shared' })
  })

  it('falls back to the shared flow when the connection table is not there yet', async () => {
    enableFeature()
    prismaMock.coachGoogleConnection.findUnique.mockRejectedValue(new Error('relation "CoachGoogleConnection" does not exist'))
    expect(await resolveCalendarMode({ coachId: 'c1', now, maxDaysAhead: 7 })).toEqual({ kind: 'shared' })
  })
})

function setupBooking(opts: { fallbackMeetingUrl?: string | null } = {}) {
  prismaMock.candidateProfile.findFirst.mockResolvedValue({ id: 'm1', email: 'dana@example.com', firstName: 'Dana', lastName: 'W' })
  prismaMock.coachBooking.count.mockResolvedValue(0)
  prismaMock.coachBookingSettings.findUnique.mockResolvedValue({ enabled: true, ...settings, fallbackMeetingUrl: opts.fallbackMeetingUrl ?? null })
  prismaMock.coachAvailabilityWindow.findMany.mockResolvedValue(mondayMorning)
  prismaMock.coachBooking.findMany.mockResolvedValue([])
  prismaMock.coachBooking.create.mockImplementation(async ({ data }: { data: { startsAt: Date; endsAt: Date } }) => ({ id: 'b1', ...data }))
  prismaMock.coachBooking.update.mockResolvedValue({})
  prismaMock.coach.findUniqueOrThrow.mockResolvedValue({ fullName: 'Maya Ortiz', workEmail: 'maya@example.com' })
}

describe('booking on the coach’s own calendar', () => {
  beforeEach(() => {
    enableFeature()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue({ status: 'connected' })
  })

  it('only offers times the coach’s calendar shows as free', async () => {
    prismaMock.coachBookingSettings.findUnique.mockResolvedValue({ enabled: true, ...settings, fallbackMeetingUrl: null })
    prismaMock.coachAvailabilityWindow.findMany.mockResolvedValue(mondayMorning)
    prismaMock.coachBooking.findMany.mockResolvedValue([])
    calendarMock.queryCoachBusy.mockResolvedValue({ busy: [{ startsAt: local('2026-01-12 10:00'), endsAt: local('2026-01-12 11:00') }], failedCalendars: [] })
    const view = await loadBookingView('c1', now)
    expect(view.calendar).toBe('coach')
    expect(view.slots.map((s) => s.toISOString())).toEqual([local('2026-01-12 09:00').toISOString(), local('2026-01-12 11:00').toISOString()])
  })

  it('offers nothing, and says why, when a selected calendar cannot be read', async () => {
    prismaMock.coachBookingSettings.findUnique.mockResolvedValue({ enabled: true, ...settings, fallbackMeetingUrl: null })
    prismaMock.coachAvailabilityWindow.findMany.mockResolvedValue(mondayMorning)
    prismaMock.coachBooking.findMany.mockResolvedValue([])
    calendarMock.queryCoachBusy.mockResolvedValue({ busy: [], failedCalendars: ['family@group.calendar.google.com'] })
    const view = await loadBookingView('c1', now)
    expect(view).toMatchObject({ slots: [], calendar: 'unreadable' })
  })

  it('creates the event on the coach’s calendar with the client as guest, and stores the event, calendar and Meet link', async () => {
    setupBooking({ fallbackMeetingUrl: 'https://fallback.example/room' })
    calendarMock.queryCoachBusy.mockResolvedValue({ busy: [], failedCalendars: [] })
    calendarMock.createCoachMeetEvent.mockResolvedValue({ eventId: 'evt_1', meetUrl: 'https://meet.google.com/abc-defg-hij', calendarId: 'primary' })

    const result = await bookSlot({ coachId: 'c1', candidateId: 'm1', startsAt: local('2026-01-12 09:00') })

    expect(result).toEqual({ ok: true, bookingId: 'b1', meetUrl: 'https://meet.google.com/abc-defg-hij', calendar: 'coach' })
    expect(createMeetEvent).not.toHaveBeenCalled()
    const [coachId, input] = calendarMock.createCoachMeetEvent.mock.calls[0]
    expect(coachId).toBe('c1')
    expect(input.attendeeEmails).toEqual(['dana@example.com']) // the coach is the organizer, not a guest
    expect(input.bookingId).toBe('b1')
    expect(prismaMock.coachBooking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { googleEventId: 'evt_1', googleCalendarId: 'primary', meetUrl: 'https://meet.google.com/abc-defg-hij' } })
    expect(sendBookingEmail).not.toHaveBeenCalled() // Google's invitation is the confirmation
  })

  it('refuses a time the coach’s calendar shows busy, even though NextChapter has no booking there', async () => {
    setupBooking()
    calendarMock.queryCoachBusy.mockResolvedValue({ busy: [{ startsAt: local('2026-01-12 09:00'), endsAt: local('2026-01-12 10:00') }], failedCalendars: [] })
    const result = await bookSlot({ coachId: 'c1', candidateId: 'm1', startsAt: local('2026-01-12 09:00') })
    expect(result).toMatchObject({ ok: false })
    expect(prismaMock.coachBooking.create).not.toHaveBeenCalled()
    expect(calendarMock.createCoachMeetEvent).not.toHaveBeenCalled()
  })

  it('keeps the booking and emails both people when the coach’s calendar will not take the event', async () => {
    setupBooking({ fallbackMeetingUrl: 'https://fallback.example/room' })
    calendarMock.queryCoachBusy.mockResolvedValue({ busy: [], failedCalendars: [] })
    calendarMock.createCoachMeetEvent.mockRejectedValue(new Error('Google was unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await bookSlot({ coachId: 'c1', candidateId: 'm1', startsAt: local('2026-01-12 09:00') })
    expect(result).toMatchObject({ ok: true, meetUrl: 'https://fallback.example/room' })
    expect(sendBookingEmail).toHaveBeenCalledTimes(2)
  })
})

describe('losing Google access', () => {
  beforeEach(() => {
    enableFeature()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
  })

  it('pauses new bookings while the connection is disconnected: nothing offered, nothing accepted', async () => {
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue({ status: 'disconnected' })
    prismaMock.coachBookingSettings.findUnique.mockResolvedValue({ enabled: true, ...settings, fallbackMeetingUrl: null })
    prismaMock.coachAvailabilityWindow.findMany.mockResolvedValue(mondayMorning)
    prismaMock.coachBooking.findMany.mockResolvedValue([])
    expect(await loadBookingView('c1', now)).toMatchObject({ slots: [], calendar: 'paused' })

    setupBooking()
    const result = await bookSlot({ coachId: 'c1', candidateId: 'm1', startsAt: local('2026-01-12 09:00') })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('not taking new bookings') })
    expect(prismaMock.coachBooking.create).not.toHaveBeenCalled()
  })

  it('pauses when Google reports the access as gone mid-request', async () => {
    const { CoachGoogleError } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue({ status: 'connected' })
    calendarMock.queryCoachBusy.mockRejectedValue(new CoachGoogleError('disconnected', 'gone'))
    expect(await resolveCalendarMode({ coachId: 'c1', now, maxDaysAhead: 7 })).toEqual({ kind: 'paused' })
  })

  it('fails closed, without disconnecting, when Google is only briefly unreachable', async () => {
    const { CoachGoogleError } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue({ status: 'connected' })
    calendarMock.queryCoachBusy.mockRejectedValue(new CoachGoogleError('transient', 'timeout'))
    expect(await resolveCalendarMode({ coachId: 'c1', now, maxDaysAhead: 7 })).toEqual({ kind: 'unreadable' })
    expect(prismaMock.coachGoogleConnection.updateMany).not.toHaveBeenCalled()
  })
})

describe('refreshing the coach token', () => {
  const expired = { coachId: 'c1', status: 'connected', accessToken: 'old', refreshToken: 'refresh-me', expiresAt: new Date(Date.now() - 1000), conflictCalendarIds: ['primary'] }

  beforeEach(() => enableFeature())

  it('marks the coach disconnected, clears the tokens and keeps the rest when Google answers invalid_grant', async () => {
    const { getCoachAccessToken } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue(expired)
    prismaMock.coachGoogleConnection.updateMany.mockResolvedValue({ count: 1 })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })))

    await expect(getCoachAccessToken('c1')).rejects.toMatchObject({ kind: 'disconnected' })
    expect(prismaMock.coachGoogleConnection.updateMany).toHaveBeenCalledWith({
      where: { coachId: 'c1', status: 'connected' },
      data: expect.objectContaining({ status: 'disconnected', disconnectReason: 'revoked', accessToken: '', refreshToken: '' }),
    })
    // Existing bookings are not touched.
    expect(prismaMock.coachBooking.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.coachBooking.update).not.toHaveBeenCalled()
  })

  it('does not disconnect on an outage or a misconfigured client', async () => {
    const { getCoachAccessToken } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue(expired)
    for (const response of [new Response('{}', { status: 503 }), new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })]) {
      vi.stubGlobal('fetch', vi.fn(async () => response))
      await expect(getCoachAccessToken('c1')).rejects.toMatchObject({ kind: 'transient' })
    }
    expect(prismaMock.coachGoogleConnection.updateMany).not.toHaveBeenCalled()
  })

  it('refreshes an expired token, saves it and uses it', async () => {
    const { getCoachAccessToken } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue(expired)
    prismaMock.coachGoogleConnection.update.mockResolvedValue({})
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600, token_type: 'Bearer', scope: '' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { accessToken } = await getCoachAccessToken('c1')
    expect(accessToken).toBe('fresh')
    const body = (fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body
    expect(body.get('client_id')).toBe('coach-client-id')
    expect(body.get('grant_type')).toBe('refresh_token')
  })

  it('refuses to run while the feature is off, and for a coach who never connected', async () => {
    const { getCoachAccessToken } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue(null)
    await expect(getCoachAccessToken('c1')).rejects.toMatchObject({ kind: 'not_connected' })
    vi.unstubAllEnvs()
    await expect(getCoachAccessToken('c1')).rejects.toMatchObject({ kind: 'off' })
  })

  it('lets the coach disconnect: revokes at Google and marks the connection, leaving bookings alone', async () => {
    const { disconnectCoachGoogle } = await import('@/lib/coach/google/connection')
    prismaMock.coachGoogleConnection.findUnique.mockResolvedValue({ status: 'connected', refreshToken: 'refresh-me', accessToken: 'a' })
    prismaMock.coachGoogleConnection.updateMany.mockResolvedValue({ count: 1 })
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await disconnectCoachGoogle('c1')
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('oauth2.googleapis.com/revoke')
    expect(prismaMock.coachGoogleConnection.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'disconnected', disconnectReason: 'coach' }) }))
    expect(prismaMock.coachBooking.updateMany).not.toHaveBeenCalled()
  })
})
