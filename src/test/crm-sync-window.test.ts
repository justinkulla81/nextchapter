import { describe, expect, it } from 'vitest'
import { GMAIL_WINDOW_MAX_DAYS, scheduledGmailWindowDays } from '@/lib/crm/sync-window'

const HOUR = 3_600_000
const now = Date.UTC(2026, 10, 18, 16, 0)

describe('scheduledGmailWindowDays', () => {
  it('an hourly sweep after a clean one an hour ago reaches back seven hours, not two days', () => {
    expect(scheduledGmailWindowDays(1, new Date(now - HOUR), now) * 24).toBeCloseTo(7)
  })
  it('after failed runs it reaches back to the last clean sweep plus the margin', () => {
    expect(scheduledGmailWindowDays(1, new Date(now - 17 * HOUR), now) * 24).toBeCloseTo(23)
  })
  it('never less than one interval plus the margin', () => {
    expect(scheduledGmailWindowDays(24, new Date(now - HOUR), now) * 24).toBeCloseTo(30)
  })
  it('caps at the maximum, and uses it with no clean sweep on record', () => {
    expect(scheduledGmailWindowDays(1, new Date(now - 40 * 24 * HOUR), now)).toBe(GMAIL_WINDOW_MAX_DAYS)
    expect(scheduledGmailWindowDays(1, null, now)).toBe(GMAIL_WINDOW_MAX_DAYS)
  })
})
