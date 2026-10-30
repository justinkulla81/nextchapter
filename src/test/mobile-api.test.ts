import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  allow: vi.fn(async () => true),
  search: vi.fn(),
  layoffs: vi.fn(),
  userId: vi.fn(),
  upsertDevice: vi.fn(),
  count: vi.fn(),
  upsertSaved: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  check: vi.fn(),
  titles: vi.fn(),
}))

vi.mock('@/lib/security/rate-limit', () => ({ allowByIp: m.allow, HOUR_MS: 3600000 }))
vi.mock('@/lib/jobs/public-board', async (orig) => ({ ...(await orig<typeof import('@/lib/jobs/public-board')>()), searchPublicBoardCached: m.search }))
vi.mock('@/lib/layoffs/public-query', () => ({ queryLayoffs: m.layoffs, validState: (s: string | null) => !s || /^[A-Z]{2}$/i.test(s) }))
vi.mock('@/lib/mobile/auth', () => ({ mobileUserId: m.userId }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    mobileDevice: { upsert: m.upsertDevice },
    mobileSavedSearch: { count: m.count, upsert: m.upsertSaved, deleteMany: m.deleteMany, findMany: m.findMany },
  },
}))
vi.mock('@/lib/ai-check/load', () => ({ loadOccupationCheck: m.check }))
vi.mock('@/lib/careers/candidate-occupation', () => ({ searchOccupationTitles: m.titles }))
vi.mock('@/lib/skills/ai-exposure-server', () => ({ loadExposureMap: async () => new Map([['15-1252', { title: 'Software Developers', score: 0.4 }]]) }))

import { GET as jobsGet } from '@/app/api/mobile/jobs/route'
import { GET as layoffsGet } from '@/app/api/mobile/layoffs/route'
import { GET as aiGet } from '@/app/api/mobile/ai-check/route'
import { POST as devicePost } from '@/app/api/mobile/devices/route'
import { GET as savedGet, POST as savedPost, DELETE as savedDelete } from '@/app/api/mobile/saved/route'
import { mobileJobQuery } from '@/lib/mobile/params'

const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`https://launchyournextchapter.com${path}`, init)
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  m.allow.mockResolvedValue(true)
})

describe('mobileJobQuery', () => {
  it('cleans words, folds "remote" place into the flag, and bounds pay and offset', () => {
    expect(mobileJobQuery(new URLSearchParams('q=%20product%20%20manager&loc=Remote&minPay=120000&offset=24'))).toEqual({ q: 'product manager', loc: '', remote: true, minPay: 120000, offset: 24 })
    expect(mobileJobQuery(new URLSearchParams('minPay=abc&offset=-5'))).toEqual({ q: '', loc: '', remote: false })
    expect(mobileJobQuery(new URLSearchParams('minPay=99999999999&offset=99999')).minPay).toBeUndefined()
  })
})

describe('GET /api/mobile/jobs', () => {
  it('returns the board result with a shared cache header', async () => {
    m.search.mockResolvedValue({ total: 10, jobs: [{ id: 'a', url: 'https://careers.example.com/1' }] })
    const res = await jobsGet(req('/api/mobile/jobs?q=analyst&minPay=90000'))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=300')
    expect((await res.json()).jobs[0].url).toBe('https://careers.example.com/1')
    expect(m.search).toHaveBeenCalledWith({ q: 'analyst', loc: '', remote: false, minPay: 90000 })
  })
  it('is rate limited', async () => {
    m.allow.mockResolvedValue(false)
    expect((await jobsGet(req('/api/mobile/jobs'))).status).toBe(429)
    expect(m.search).not.toHaveBeenCalled()
  })
  it('answers 503 when the search fails', async () => {
    m.search.mockRejectedValue(new Error('db'))
    expect((await jobsGet(req('/api/mobile/jobs'))).status).toBe(503)
  })
})

describe('GET /api/mobile/layoffs', () => {
  it('rejects a bad state and passes defaults through', async () => {
    expect((await layoffsGet(req('/api/mobile/layoffs?state=Texas'))).status).toBe(400)
    m.layoffs.mockResolvedValue({ notices: [] })
    const res = await layoffsGet(req('/api/mobile/layoffs?state=tx&employer=Acme'))
    expect(res.status).toBe(200)
    expect(m.layoffs).toHaveBeenCalledWith({ state: 'tx', employer: 'Acme', days: 30, limit: 30 })
  })
})

describe('GET /api/mobile/ai-check', () => {
  it('lists occupations with measured exposure for a title', async () => {
    m.titles.mockResolvedValue([{ socCode: '15-1252.00', title: 'Software Developers', score: 1 }, { socCode: '99-9999.00', title: 'Unmeasured', score: 0.5 }])
    const body = await (await aiGet(req('/api/mobile/ai-check?q=developer'))).json()
    expect(body.matches).toEqual([{ title: 'Software Developers', soc6: '15-1252', exact: true }])
  })
  it('returns a result card with a share link and rejects a malformed soc', async () => {
    expect((await aiGet(req('/api/mobile/ai-check?soc=abc'))).status).toBe(400)
    m.check.mockResolvedValue({ exposure: { soc6: '15-1252', title: 'Software Developers', score: 0.4, band: 'high' }, need: 'build_now', medianWage: 130000, tasks: ['t'], skillsToBuild: ['s'], bets: [] })
    const body = await (await aiGet(req('/api/mobile/ai-check?soc=15-1252'))).json()
    expect(body.scorePercent).toBe('40%')
    expect(body.shareUrl).toBe('https://launchyournextchapter.com/tools/ai-job-check/software-developers-15-1252')
    m.check.mockResolvedValue(null)
    expect((await aiGet(req('/api/mobile/ai-check?soc=11-1111'))).status).toBe(404)
  })
})

describe('POST /api/mobile/devices', () => {
  it('rejects a malformed token and stores a valid one', async () => {
    m.userId.mockResolvedValue(null)
    expect((await devicePost(req('/api/mobile/devices', json({ pushToken: 'nope', platform: 'ios' })))).status).toBe(400)
    const res = await devicePost(req('/api/mobile/devices', json({ pushToken: 'ExponentPushToken[abcdefghijklmnop]', platform: 'ios' })))
    expect(res.status).toBe(200)
    expect(m.upsertDevice.mock.calls[0][0].create).toEqual({ pushToken: 'ExponentPushToken[abcdefghijklmnop]', platform: 'ios', userId: null })
  })
})

describe('/api/mobile/saved', () => {
  it('needs sign-in', async () => {
    m.userId.mockResolvedValue(null)
    expect((await savedGet(req('/api/mobile/saved'))).status).toBe(401)
    expect((await savedPost(req('/api/mobile/saved', json({ kind: 'jobs', q: 'x' })))).status).toBe(401)
    expect((await savedDelete(req('/api/mobile/saved?id=1', { method: 'DELETE' }))).status).toBe(401)
  })
  it('saves a jobs search, normalised, and an employer without place or pay', async () => {
    m.userId.mockResolvedValue('u1')
    m.count.mockResolvedValue(0)
    m.upsertSaved.mockImplementation(async ({ create }) => create)
    await savedPost(req('/api/mobile/saved', json({ kind: 'jobs', q: ' Data  Analyst', loc: 'Austin', remote: true, minPay: 100000 })))
    expect(m.upsertSaved.mock.calls[0][0].create).toEqual({ userId: 'u1', kind: 'jobs', q: 'data analyst', loc: 'austin', remote: true, minPay: 100000 })
    await savedPost(req('/api/mobile/saved', json({ kind: 'employer', q: 'Acme', loc: 'Austin', minPay: 5 })))
    expect(m.upsertSaved.mock.calls[1][0].create).toEqual({ userId: 'u1', kind: 'employer', q: 'acme', loc: '', remote: false, minPay: 0 })
  })
  it('validates kind, employer name and the 25 cap', async () => {
    m.userId.mockResolvedValue('u1')
    m.count.mockResolvedValue(0)
    expect((await savedPost(req('/api/mobile/saved', json({ kind: 'x' })))).status).toBe(400)
    expect((await savedPost(req('/api/mobile/saved', json({ kind: 'employer', q: 'a' })))).status).toBe(400)
    m.count.mockResolvedValue(25)
    expect((await savedPost(req('/api/mobile/saved', json({ kind: 'jobs', q: 'x' })))).status).toBe(409)
  })
  it('deletes only the caller’s row', async () => {
    m.userId.mockResolvedValue('u1')
    await savedDelete(req('/api/mobile/saved?id=abc', { method: 'DELETE' }))
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: 'abc', userId: 'u1' } })
  })
})
