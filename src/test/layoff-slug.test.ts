import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('stripSlugSuffixes', () => {
  it('drops every trailing legal suffix so one employer keeps one page', async () => {
    const { stripSlugSuffixes } = await import('@/lib/warn/layoff-pages')
    expect(stripSlugSuffixes('intel-corporation')).toBe('intel')
    expect(stripSlugSuffixes('acme-co-inc')).toBe('acme')
    expect(stripSlugSuffixes('company')).toBe('company')
    expect(stripSlugSuffixes('oracle-america')).toBe('oracle-america')
  })
})
