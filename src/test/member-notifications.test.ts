import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { createMany } = vi.hoisted(() => ({ createMany: vi.fn(async () => ({ count: 1 })) }))
vi.mock('@/lib/prisma', () => ({ prisma: { memberNotification: { createMany } } }))

import { isSafeHref, notifyMember } from '@/lib/notifications/member-notifications'

describe('isSafeHref', () => {
  it('allows same-site paths only', () => {
    expect(isSafeHref('/dashboard/jobs')).toBe(true)
    expect(isSafeHref('//evil.com')).toBe(false)
    expect(isSafeHref('https://evil.com')).toBe(false)
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
  })
})

describe('notifyMember', () => {
  it('writes a notification with skipDuplicates so a rerun does not repeat it', async () => {
    const wrote = await notifyMember('c1', { kind: 'layoff', title: 'Layoff at Acme', href: '/layoffs/acme', dedupeKey: 'layoff:acme' })
    expect(wrote).toBe(true)
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
  })
  it('refuses an off-site link without writing', async () => {
    createMany.mockClear()
    expect(await notifyMember('c1', { kind: 'x', title: 't', href: 'https://evil.com', dedupeKey: 'k' })).toBe(false)
    expect(createMany).not.toHaveBeenCalled()
  })
})
