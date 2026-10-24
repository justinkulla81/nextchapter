import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The requests made to the coach's own Google Calendar: what is sent, and what comes back. fetch is mocked.

const connectionMock = vi.hoisted(() => ({
  coachGoogleFetch: vi.fn(async (_coachId: string, run: (token: string, calendarIds: string[]) => Promise<Response>) => run('coach-access-token', ['work@example.com', 'primary'])),
}))
vi.mock('@/lib/coach/google/connection', async () => {
  class CoachGoogleError extends Error {
    constructor(
      readonly kind: string,
      message: string
    ) {
      super(message)
    }
  }
  return { ...connectionMock, CoachGoogleError }
})
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { createCoachMeetEvent, deleteCoachEvent, moveCoachEvent, queryCoachBusy } from '@/lib/coach/google/calendar'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const start = new Date('2026-01-12T14:00:00.000Z')
const end = new Date('2026-01-12T14:45:00.000Z')

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createCoachMeetEvent', () => {
  it('creates the event on the first selected calendar, with a Meet link request, the client as guest and our tag', async () => {
    fetchMock.mockResolvedValue(json({ id: 'evt_9', hangoutLink: 'https://meet.google.com/xyz-abcd-efg' }))
    const result = await createCoachMeetEvent('c1', { summary: 'Coaching session', description: 'd', start, end, attendeeEmails: ['dana@example.com'], bookingId: 'b1' })

    expect(result).toEqual({ eventId: 'evt_9', meetUrl: 'https://meet.google.com/xyz-abcd-efg', calendarId: 'work@example.com' })
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }]
    expect(url).toContain('/calendars/work%40example.com/events')
    expect(url).toContain('conferenceDataVersion=1')
    expect(url).toContain('sendUpdates=all')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer coach-access-token')
    const body = JSON.parse(init.body)
    expect(body.attendees).toEqual([{ email: 'dana@example.com' }])
    expect(body.conferenceData.createRequest).toEqual({ requestId: 'b1', conferenceSolutionKey: { type: 'hangoutsMeet' } })
    expect(body.extendedProperties.private.nextchapterBookingId).toBe('b1')
    expect(body.start.dateTime).toBe(start.toISOString())
    expect(body.reminders.overrides).toEqual([{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 60 }])
  })

  it('returns no Meet link when Google did not make one, and throws when the event was not created', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'evt_9' }))
    expect((await createCoachMeetEvent('c1', { summary: 's', description: 'd', start, end, attendeeEmails: [], bookingId: 'b1' })).meetUrl).toBeNull()

    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(json({ error: { errors: [{ reason: 'forbidden' }] } }, 403))
    await expect(createCoachMeetEvent('c1', { summary: 's', description: 'd', start, end, attendeeEmails: [], bookingId: 'b1' })).rejects.toMatchObject({ kind: 'transient' })
  })
})

describe('queryCoachBusy', () => {
  it('asks Google for busy time on every selected calendar and returns intervals', async () => {
    fetchMock.mockResolvedValue(
      json({ calendars: { 'work@example.com': { busy: [{ start: '2026-01-12T14:00:00Z', end: '2026-01-12T15:00:00Z' }] }, primary: { busy: [] } } })
    )
    const result = await queryCoachBusy('c1', new Date('2026-01-11T00:00:00Z'), new Date('2026-01-20T00:00:00Z'))
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy')
    expect(JSON.parse(init.body).items).toEqual([{ id: 'work@example.com' }, { id: 'primary' }])
    expect(result.busy).toHaveLength(1)
    expect(result.failedCalendars).toEqual([])
  })

  it('can check one given calendar, and reports it when Google cannot see it', async () => {
    fetchMock.mockResolvedValue(json({ calendars: { 'typo@example.com': { errors: [{ reason: 'notFound' }] } } }))
    const result = await queryCoachBusy('c1', new Date(), new Date(Date.now() + 1000), ['typo@example.com'])
    expect(result.failedCalendars).toEqual(['typo@example.com'])
  })

  it('throws, rather than returning "free", when Google fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue(json({}, 500))
    await expect(queryCoachBusy('c1', new Date(), new Date())).rejects.toMatchObject({ kind: 'transient' })
  })
})

describe('moving and deleting events we made', () => {
  it('moves an event with a PATCH that changes only the times', async () => {
    fetchMock.mockResolvedValue(json({}))
    expect(await moveCoachEvent('c1', 'work@example.com', 'evt_9', start, end)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toContain('/calendars/work%40example.com/events/evt_9')
    expect(init.method).toBe('PATCH')
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['end', 'start'])
  })

  it('treats an event that is already gone as deleted, and reports a real failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await deleteCoachEvent('c1', 'primary', 'evt_9')).toBe(true)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }))
    expect(await deleteCoachEvent('c1', 'primary', 'evt_9')).toBe(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    expect(await deleteCoachEvent('c1', 'primary', 'evt_9')).toBe(false)
  })

  it('reports false instead of throwing when the coach’s access is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    connectionMock.coachGoogleFetch.mockRejectedValueOnce(new Error('disconnected'))
    expect(await deleteCoachEvent('c1', 'primary', 'evt_9')).toBe(false)
  })
})
