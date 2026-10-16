import { describe, it, expect } from 'vitest'
import { safeHttpUrl, splitUpcoming, deadlinePassed } from '@/lib/higher-ed/recruiting-rules'

describe('recruiting rules', () => {
  it('accepts only http(s) links', () => {
    expect(safeHttpUrl('https://acme.com/careers')).toBe('https://acme.com/careers')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,hi')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl('  ')).toBeNull()
  })

  it('puts upcoming dates first, soonest first, and past ones after, newest first', () => {
    const now = new Date('2026-10-15T12:00:00Z')
    const d = (iso: string) => ({ startsAt: new Date(iso) })
    const { upcoming, past } = splitUpcoming([d('2026-12-01'), d('2026-09-01'), d('2026-10-20'), d('2026-08-01')], now)
    expect(upcoming.map((r) => r.startsAt.toISOString().slice(0, 10))).toEqual(['2026-10-20', '2026-12-01'])
    expect(past.map((r) => r.startsAt.toISOString().slice(0, 10))).toEqual(['2026-09-01', '2026-08-01'])
  })

  it('keeps a deadline open through the day it falls on', () => {
    const now = new Date('2026-10-15T20:00:00Z')
    expect(deadlinePassed(new Date('2026-10-15T00:00:00Z'), now)).toBe(false)
    expect(deadlinePassed(new Date('2026-10-14T00:00:00Z'), now)).toBe(true)
    expect(deadlinePassed(null, now)).toBe(false)
  })
})
