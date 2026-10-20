import { describe, expect, it } from 'vitest'
import { sendsToday } from '@/lib/email/send-days'

const monday = new Date('2026-10-19T12:00:00Z')
const tuesday = new Date('2026-10-20T12:00:00Z')

describe('sendsToday', () => {
  it('sends every day when unset or empty', () => {
    expect(sendsToday(undefined, monday)).toBe(true)
    expect(sendsToday('', tuesday)).toBe(true)
  })
  it('sends only on the listed weekdays', () => {
    expect(sendsToday('1,3,5', monday)).toBe(true)
    expect(sendsToday('1,3,5', tuesday)).toBe(false)
  })
  it('falls back to every day on an unreadable value', () => {
    expect(sendsToday('mon,wed', tuesday)).toBe(true)
    expect(sendsToday('9', tuesday)).toBe(true)
  })
})
