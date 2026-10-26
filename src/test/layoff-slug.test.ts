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

describe('mergedSlug', () => {
  it('moves the ruled subsidiaries onto their parent and leaves other slugs alone', async () => {
    const { mergedSlug, employerSlug } = await import('@/lib/warn/layoff-pages')
    expect(mergedSlug('oracle-america')).toBe('oracle')
    expect(mergedSlug('meta-platforms')).toBe('meta')
    expect(mergedSlug('amazon-fresh')).toBe('amazon-fresh')
    expect(employerSlug('Meta Platforms, Inc.', null)).toBe('meta')
    expect(employerSlug('Oracle America, Inc.', null)).toBe('oracle')
  })
})
