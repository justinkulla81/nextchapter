import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const fn = () => vi.fn()
  return {
    conferenceEvent: { findMany: fn(), findUniqueOrThrow: fn(), create: fn() },
    conferenceExtraction: { findUnique: fn(), upsert: fn() },
    conferenceQuickAddLog: { count: fn(), create: fn() },
    conferenceEdition: { upsert: fn(), findFirst: fn() },
    conferenceOpportunity: { createMany: fn() },
    userConference: { findUnique: fn(), upsert: fn() },
  }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
const extract = vi.hoisted(() => ({ fetchPublicPage: vi.fn(), extractWithModel: vi.fn() }))
vi.mock('./extract', () => extract)

import { confirmQuickAdd, previewQuickAdd } from './quick-add'

const exAll = { name: 'Future Summit', organizer: null, startDate: '2027-05-04', endDate: '2027-05-05', format: 'IN_PERSON', city: 'Austin', state: 'TX', country: 'US', costLow: null, costHigh: null, costNote: null, industries: [], functions: [], seniorities: [], whyAttend: null, opportunities: [{ type: 'CALL_FOR_SPEAKERS', title: 'Speak', url: null, opensAt: null, deadline: '2027-01-10' }] }

beforeEach(() => {
  vi.clearAllMocks()
  db.conferenceEvent.findMany.mockResolvedValue([])
  db.conferenceExtraction.findUnique.mockResolvedValue(null)
  db.conferenceQuickAddLog.count.mockResolvedValue(0)
  db.userConference.findUnique.mockResolvedValue(null)
  db.conferenceEdition.findFirst.mockResolvedValue({ id: 'ed1' })
  db.conferenceEdition.upsert.mockResolvedValue({ id: 'ed1' })
})

describe('previewQuickAdd', () => {
  it('rejects a link it cannot read', async () => {
    expect(await previewQuickAdd('c1', 'not a link')).toEqual({ status: 'invalid' })
  })

  it('attaches to a catalog entry with the same canonical URL and spends no model call', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([{ id: 'hr-tech', name: 'HR Tech', urlKey: 'hrtech.com' }])
    db.conferenceEvent.findUniqueOrThrow.mockResolvedValue({ name: 'HR Tech' })
    const r = await previewQuickAdd('c1', 'https://www.hrtech.com/?utm_source=mail')
    expect(r).toMatchObject({ status: 'exists', seriesId: 'hr-tech', by: 'url' })
    expect(db.userConference.upsert).toHaveBeenCalledOnce()
    expect(extract.extractWithModel).not.toHaveBeenCalled()
  })

  it('never fetches login-walled hosts: a blank card for the member to fill', async () => {
    const r = await previewQuickAdd('c1', 'https://www.linkedin.com/events/123')
    expect(r).toMatchObject({ status: 'card', card: { manual: 'deep_link' } })
    expect(extract.fetchPublicPage).not.toHaveBeenCalled()
  })

  it('uses the cache for a repeat link: no fetch, no model call, no log row', async () => {
    db.conferenceExtraction.findUnique.mockResolvedValue({ urlKey: 'future.org', result: exAll, createdAt: new Date() })
    const r = await previewQuickAdd('c1', 'https://future.org')
    expect(r).toMatchObject({ status: 'card', fromCache: true, card: { name: 'Future Summit', manual: null } })
    expect(extract.fetchPublicPage).not.toHaveBeenCalled()
    expect(db.conferenceQuickAddLog.create).not.toHaveBeenCalled()
  })

  it('past the daily cap it still returns a card, without calling the model', async () => {
    db.conferenceQuickAddLog.count.mockResolvedValue(10)
    const r = await previewQuickAdd('c1', 'https://future.org')
    expect(r).toMatchObject({ status: 'card', card: { manual: 'daily_limit' } })
    expect(extract.extractWithModel).not.toHaveBeenCalled()
  })

  it('a failed fetch is not a dead end', async () => {
    extract.fetchPublicPage.mockResolvedValue(null)
    expect(await previewQuickAdd('c1', 'https://future.org')).toMatchObject({ status: 'card', card: { manual: 'fetch_failed' } })
  })

  it('extracts once, logs the call and caches the result', async () => {
    extract.fetchPublicPage.mockResolvedValue({ finalUrl: 'https://future.org', hash: 'h', text: '', links: [], html: '' })
    extract.extractWithModel.mockResolvedValue({ extraction: exAll, usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.002 } })
    const r = await previewQuickAdd('c1', 'https://future.org')
    expect(r).toMatchObject({ status: 'card', fromCache: false, card: { name: 'Future Summit', missing: ['industries', 'functions'] } })
    expect(db.conferenceQuickAddLog.create).toHaveBeenCalledOnce()
    expect(db.conferenceExtraction.upsert).toHaveBeenCalledOnce()
  })

  it('attaches when the page names an event we already hold under another link', async () => {
    extract.fetchPublicPage.mockResolvedValue({ finalUrl: 'https://future.org', hash: 'h', text: '', links: [], html: '' })
    extract.extractWithModel.mockResolvedValue({ extraction: { ...exAll, name: 'The Future Summit 2027' }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } })
    db.conferenceEvent.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'future-summit', name: 'Future Summit', urlKey: 'summit.example' }])
    db.conferenceEvent.findUniqueOrThrow.mockResolvedValue({ name: 'Future Summit' })
    expect(await previewQuickAdd('c1', 'https://future.org')).toMatchObject({ status: 'exists', seriesId: 'future-summit', by: 'name' })
  })
})

describe('confirmQuickAdd', () => {
  it('creates an unpublished, unverified entry with unpublished opportunities, and tracks it privately for the member', async () => {
    const r = await confirmQuickAdd('c1', { ...exAll, url: 'https://future.org', opportunities: exAll.opportunities })
    expect(r).toEqual({ seriesId: 'future-summit', created: true })
    expect(db.conferenceEvent.create.mock.calls[0][0].data).toMatchObject({ id: 'future-summit', published: false, verified: false, source: 'quick-add', urlKey: 'future.org', datesConfirmed: true })
    expect(db.conferenceOpportunity.createMany.mock.calls[0][0].data[0]).toMatchObject({ published: false, source: 'QUICK_ADD', type: 'CALL_FOR_SPEAKERS' })
    expect(db.userConference.upsert.mock.calls[0][0].create).toMatchObject({ candidateId: 'c1', seriesId: 'future-summit', status: 'INTERESTED' })
  })

  it('does not block on missing fields: falls back to the host as the name and a TBA edition', async () => {
    await confirmQuickAdd('c1', { url: 'https://nameless.org/x' })
    expect(db.conferenceEvent.create.mock.calls[0][0].data).toMatchObject({ name: 'nameless.org', datesConfirmed: false, published: false })
    expect(db.conferenceEdition.upsert.mock.calls[0][0].create).toMatchObject({ status: 'TBA' })
  })

  it('dedupes on confirm too: no second entry', async () => {
    db.conferenceEvent.findMany.mockResolvedValue([{ id: 'future-summit', name: 'Future Summit', urlKey: 'future.org' }])
    expect(await confirmQuickAdd('c1', { ...exAll, url: 'https://future.org' })).toEqual({ seriesId: 'future-summit', created: false })
    expect(db.conferenceEvent.create).not.toHaveBeenCalled()
  })

  it('refuses a link it cannot canonicalise', async () => {
    expect(await confirmQuickAdd('c1', { url: 'javascript:alert(1)' })).toBeNull()
  })
})
