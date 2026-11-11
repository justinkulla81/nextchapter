import { describe, it, expect } from 'vitest'
import { botClickReason, isHumanClick } from '@/lib/mailing/click-human'

const delivered = new Date('2026-11-11T15:55:26Z')
const click = (over: Partial<Parameters<typeof botClickReason>[0]> = {}) => ({
  ip: '198.51.100.20',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
  at: new Date(delivered.getTime() + 10 * 60 * 1000),
  deliveredAt: delivered,
  ...over,
})

describe('which list-email clicks are a person', () => {
  it('counts a click from an ordinary address and browser well after delivery', () => {
    expect(isHumanClick(click(), new Set())).toBe(true)
  })
  it('does not count a click from a cloud network, a known scanner address or a bot browser', () => {
    expect(isHumanClick(click({ ip: '74.176.10.1' }), new Set())).toBe(false)
    expect(isHumanClick(click({ ip: '203.0.113.7' }), new Set(['203.0.113.7']))).toBe(false)
    expect(isHumanClick(click({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), new Set())).toBe(false)
  })
  it('does not count a click within two minutes of delivery, but does after that', () => {
    expect(botClickReason(click({ at: new Date(delivered.getTime() + 60_000) }), new Set())).toMatch(/two minutes/)
    expect(isHumanClick(click({ at: new Date(delivered.getTime() + 3 * 60_000) }), new Set())).toBe(true)
  })
  it('counts a click when delivery is not known and nothing else marks it a bot', () => {
    expect(isHumanClick(click({ deliveredAt: null }), new Set())).toBe(true)
  })
})
