import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/membership/subscription', () => ({ isActiveMember: async () => false }))

import { newCode } from '@/lib/access/grants'

describe('coach access codes', () => {
  it('look like NC-XXXX-XXXX without confusable characters', () => {
    for (let i = 0; i < 200; i++) {
      const c = newCode()
      expect(c).toMatch(/^NC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    }
  })
  it('are not repeated', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newCode()))
    expect(seen.size).toBe(500)
  })
})
