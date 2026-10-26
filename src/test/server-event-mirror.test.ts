import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeRaw = vi.fn()
const create = vi.fn()
const after = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $executeRaw: (...a: unknown[]) => executeRaw(...a), analyticsEvent: { create: (...a: unknown[]) => create(...a) } } }))
vi.mock('next/server', () => ({ after: (...a: unknown[]) => after(...a) }))
vi.mock('posthog-node', () => ({ PostHog: class { capture() {} } }))

import { mirrorServerEvent } from '@/lib/posthog/server'

describe('mirrorServerEvent', () => {
  beforeEach(() => {
    executeRaw.mockReset().mockResolvedValue(1)
    create.mockReset()
    after.mockReset()
  })

  it('writes one autocommit INSERT, never a Prisma create (which opens a transaction)', async () => {
    mirrorServerEvent('user-1', 'job_rated', { jobId: 'j1' })
    expect(create).not.toHaveBeenCalled()
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const sql = (executeRaw.mock.calls[0][0] as TemplateStringsArray).join('?')
    expect(sql).toContain('INSERT INTO "AnalyticsEvent"')
    expect(sql).not.toMatch(/BEGIN|COMMIT/i)
  })

  it('keeps the function alive until the write finishes', async () => {
    mirrorServerEvent('user-1', 'job_rated')
    expect(after).toHaveBeenCalledTimes(1)
    await expect((after.mock.calls[0][0] as () => Promise<unknown>)()).resolves.toBeUndefined()
  })

  it('never throws: not in a request, or when the insert fails', async () => {
    after.mockImplementation(() => { throw new Error('outside a request scope') })
    executeRaw.mockRejectedValue(new Error('db down'))
    expect(() => mirrorServerEvent('u', 'e')).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })
})
