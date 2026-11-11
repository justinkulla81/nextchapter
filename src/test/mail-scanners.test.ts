import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isMailScanner } from '@/lib/marketing/mail-scanners'

describe('mail scanner address', () => {
  it('is an IP seen opening many recipients links, or one inside a known cloud network', () => {
    const seen = new Set(['203.0.113.7'])
    expect(isMailScanner('203.0.113.7', seen)).toBe(true)
    expect(isMailScanner('74.176.10.1', seen)).toBe(true) // Microsoft range in the datacenter list
    expect(isMailScanner('198.51.100.20', seen)).toBe(false)
    expect(isMailScanner(null, seen)).toBe(false)
  })
})
