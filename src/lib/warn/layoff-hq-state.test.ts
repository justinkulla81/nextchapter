import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('usStateOrNull', () => {
  it('keeps US state codes and drops foreign or junk values', async () => {
    const { usStateOrNull } = await import('./layoff-hq-state')
    expect(usStateOrNull('FL')).toBe('FL')
    expect(usStateOrNull(' oh ')).toBe('OH')
    expect(usStateOrNull('DC')).toBe('DC')
    expect(usStateOrNull('A8')).toBeNull() // SEC's code for Ontario-style and foreign addresses
    expect(usStateOrNull('X1')).toBeNull()
    expect(usStateOrNull('ON')).toBeNull()
    expect(usStateOrNull(null)).toBeNull()
  })
})
