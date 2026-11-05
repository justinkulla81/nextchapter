import { describe, expect, it, vi, beforeEach } from 'vitest'

const update = vi.hoisted(() => vi.fn().mockResolvedValue({}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { cronRun: { create: vi.fn().mockResolvedValue({ id: 'r1' }), update } } }))
vi.mock('@/lib/auth/bearer-secret', () => ({ isBearerAuthorized: () => true }))

import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'

const req = { headers: new Headers(), nextUrl: new URL('https://x.test/api/cron/a') } as unknown as NextRequest

describe('withCronRun recordResult', () => {
  beforeEach(() => update.mockClear())
  it('keeps the start of a successful answer when the job opts in', async () => {
    await withCronRun('a', async () => NextResponse.json({ dryRun: true, stoppedEarly: 'Google answered 403' }), { recordResult: true })(req)
    expect(update.mock.calls[0][0].data.detail).toContain('Google answered 403')
  })
  it('keeps nothing when the job does not opt in', async () => {
    await withCronRun('a', async () => NextResponse.json({ ok: 1 }))(req)
    expect('detail' in update.mock.calls[0][0].data).toBe(false)
  })
})
