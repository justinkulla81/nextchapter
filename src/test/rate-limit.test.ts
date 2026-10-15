import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const hits: { bucket: string; key: string; createdAt: Date }[] = []
let failDb = false

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateLimitHit: {
      count: vi.fn(async ({ where }: { where: { bucket: string; key: string; createdAt: { gte: Date } } }) => {
        if (failDb) throw new Error('relation "RateLimitHit" does not exist')
        return hits.filter((h) => h.bucket === where.bucket && h.key === where.key && h.createdAt >= where.createdAt.gte).length
      }),
      create: vi.fn(async ({ data }: { data: { bucket: string; key: string } }) => {
        hits.push({ ...data, createdAt: new Date() })
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}))

let ip: string | null = '203.0.113.7'
vi.mock('@/lib/http/client-ip', () => ({ getClientIp: async () => ip }))

import { allowByIp, allowByTarget, allowRequest } from '@/lib/security/rate-limit'

beforeEach(() => {
  hits.length = 0
  failDb = false
  ip = '203.0.113.7'
})

describe('rate limiter', () => {
  it('allows up to the limit then blocks, without recording blocked attempts', async () => {
    for (let i = 0; i < 3; i++) expect(await allowRequest({ bucket: 'b', key: 'k', limit: 3, windowMs: 60_000 })).toBe(true)
    expect(await allowRequest({ bucket: 'b', key: 'k', limit: 3, windowMs: 60_000 })).toBe(false)
    expect(hits.length).toBe(3)
  })

  it('keys are independent per bucket and per key', async () => {
    await allowRequest({ bucket: 'a', key: 'k', limit: 1, windowMs: 60_000 })
    expect(await allowRequest({ bucket: 'a', key: 'k', limit: 1, windowMs: 60_000 })).toBe(false)
    expect(await allowRequest({ bucket: 'b', key: 'k', limit: 1, windowMs: 60_000 })).toBe(true)
    expect(await allowRequest({ bucket: 'a', key: 'other', limit: 1, windowMs: 60_000 })).toBe(true)
  })

  it('forgets hits outside the window', async () => {
    hits.push({ bucket: 'b', key: 'k', createdAt: new Date(Date.now() - 2 * 60_000) })
    expect(await allowRequest({ bucket: 'b', key: 'k', limit: 1, windowMs: 60_000 })).toBe(true)
  })

  it('fails open when the table is missing', async () => {
    failDb = true
    expect(await allowRequest({ bucket: 'b', key: 'k', limit: 1, windowMs: 60_000 })).toBe(true)
  })

  it('allows when there is no IP to key on', async () => {
    ip = null
    for (let i = 0; i < 5; i++) expect(await allowByIp('x', 1, 60_000)).toBe(true)
  })

  it('normalizes and hashes the target, never storing the raw address', async () => {
    expect(await allowByTarget('t', 'Friend@Example.com ', 1, 60_000)).toBe(true)
    expect(await allowByTarget('t', 'friend@example.com', 1, 60_000)).toBe(false)
    expect(hits[0].key).not.toContain('friend')
    expect(hits[0].key).toMatch(/^[0-9a-f]{32}$/)
  })
})
