import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  userConference: { findMany: vi.fn() },
  conferenceEvent: { findMany: vi.fn(), update: vi.fn() },
  conferenceChange: { findMany: vi.fn(), create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const ex = vi.hoisted(() => ({ fetchPublicPage: vi.fn(), extractWithModel: vi.fn() }))
vi.mock('./extract', () => ex)
vi.mock('./editions', () => ({ rollEditions: vi.fn().mockResolvedValue(2) }))

import { runConferenceRecheck } from './recheck'

const NOW = new Date('2026-10-23T00:00:00Z')
const series = (over = {}) => ({ id: 's1', url: 'https://c.com', contentHash: 'old', startDate: new Date('2026-09-14T00:00:00Z'), endDate: new Date('2026-09-16T00:00:00Z'), datesConfirmed: true, opportunities: [], ...over })
const page = (hash: string, text = '') => ({ finalUrl: 'https://c.com', html: '', links: [], text, hash })

beforeEach(() => {
  vi.clearAllMocks()
  db.userConference.findMany.mockResolvedValue([])
  db.conferenceChange.findMany.mockResolvedValue([])
  ex.extractWithModel.mockResolvedValue(null)
})

describe('runConferenceRecheck', () => {
  it('an unchanged page costs nothing: no model call, no change', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series()])
    ex.fetchPublicPage.mockResolvedValue(page('old'))
    const r = await runConferenceRecheck(NOW)
    expect(r).toMatchObject({ checked: 1, unchanged: 1, modelCalls: 0, flagged: 0, rolled: 2 })
    expect(ex.extractWithModel).not.toHaveBeenCalled()
  })

  it('the first visit only records a baseline: no model call, nothing flagged', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series({ contentHash: null })])
    ex.fetchPublicPage.mockResolvedValue(page('h1', 'September 13-15, 2027'))
    const r = await runConferenceRecheck(NOW)
    expect(r).toMatchObject({ baselined: 1, modelCalls: 0, flagged: 0 })
    expect(db.conferenceEvent.update.mock.calls[0][0].data.contentHash).toBe('h1')
    expect(db.conferenceChange.create).not.toHaveBeenCalled()
  })

  it('a changed page with new dates and a new speaker call is flagged for confirmation, never applied', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series()])
    ex.fetchPublicPage.mockResolvedValue(page('new', 'Join us September 13-15, 2027 in Austin'))
    ex.extractWithModel.mockResolvedValue({ extraction: { opportunities: [{ type: 'CALL_FOR_SPEAKERS', title: 'Speak', url: 'https://c.com/speak', deadline: '2027-02-01', opensAt: null }] }, usage: {} })
    const r = await runConferenceRecheck(NOW)
    expect(r).toMatchObject({ changed: 1, modelCalls: 1, flagged: 2 })
    expect(db.conferenceChange.create.mock.calls.map((c) => c[0].data.kind).sort()).toEqual(['DATES', 'NEW_OPPORTUNITY'])
    // The series row is touched only for bookkeeping (hash and check time), never for dates.
    expect(Object.keys(db.conferenceEvent.update.mock.calls.at(-1)![0].data).sort()).toEqual(['contentHash', 'recheckedAt'])
  })

  it('the model budget caps how many changed pages are read by the model', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series({ id: 'a', url: 'https://a.com' }), series({ id: 'b', url: 'https://b.com' }), series({ id: 'c', url: 'https://c2.com' })])
    ex.fetchPublicPage.mockResolvedValue(page('new'))
    const r = await runConferenceRecheck(NOW, { modelCap: 2 })
    expect(r.modelCalls).toBe(2)
    expect(r.changed).toBe(3)
  })

  it('does not re-flag a change already waiting', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series()])
    ex.fetchPublicPage.mockResolvedValue(page('new', 'September 13-15, 2027'))
    db.conferenceChange.findMany.mockResolvedValue([{ kind: 'DATES', payload: { start: '2027-09-13', end: '2027-09-15' } }])
    expect((await runConferenceRecheck(NOW)).flagged).toBe(0)
  })

  it('an unreadable page is skipped quietly', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([series()])
    ex.fetchPublicPage.mockResolvedValue(null)
    expect((await runConferenceRecheck(NOW)).checked).toBe(0)
  })
})
