import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isEmployerIndexable } from '@/lib/seo/employer-pages'

const p = (openNow: number, opened12mo = 0) => ({ openNow, opened12mo })

describe('employer page index rule', () => {
  it('indexes 3+ open roles', () => expect(isEmployerIndexable(p(3), null)).toBe(true))
  it('indexes 1-2 roles only with hiring history and an industry', () => {
    expect(isEmployerIndexable(p(2, 3), 'Software')).toBe(true)
    expect(isEmployerIndexable(p(2, 3), null)).toBe(false)
    expect(isEmployerIndexable(p(2, 1), 'Software')).toBe(false)
  })
  it('indexes a company with a layoff notice or an SEC event whatever it is hiring', () => {
    expect(isEmployerIndexable(null, null, { layoffNotice: true })).toBe(true)
    expect(isEmployerIndexable(p(0), null, { secEvent: true })).toBe(true)
    expect(isEmployerIndexable(p(1), null, true)).toBe(true)
  })
  it('indexes a confirmed headquarters only with an industry and a live role', () => {
    expect(isEmployerIndexable(p(1), 'Retail', { hqConfirmed: true })).toBe(true)
    expect(isEmployerIndexable(p(0), 'Retail', { hqConfirmed: true })).toBe(false)
    expect(isEmployerIndexable(p(1), null, { hqConfirmed: true })).toBe(false)
    expect(isEmployerIndexable(null, 'Retail', { hqConfirmed: true })).toBe(false)
  })
  it('never indexes a college or university', () => expect(isEmployerIndexable(p(9, 9), 'Education', { higherEd: true, secEvent: true })).toBe(false))
  it('leaves a thin page out', () => expect(isEmployerIndexable(p(1), 'Retail')).toBe(false))
})
