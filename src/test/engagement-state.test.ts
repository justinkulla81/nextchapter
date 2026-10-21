import { describe, expect, it } from 'vitest'
import { engagementState, rotationAllowedForEngagement, COOLING_AFTER_DAYS, DORMANT_AFTER_DAYS } from '@/lib/email/engagement-state'
import { winBackSpacedOut, WIN_BACK_MIN_GAP_DAYS } from '@/lib/winback/sequence'

const now = new Date('2026-10-19T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

describe('engagementState', () => {
  it('is active up to the cooling threshold', () => {
    expect(engagementState(daysAgo(0), now)).toBe('active')
    expect(engagementState(daysAgo(COOLING_AFTER_DAYS - 1), now)).toBe('active')
  })
  it('is cooling from 14 days until 63', () => {
    expect(engagementState(daysAgo(COOLING_AFTER_DAYS), now)).toBe('cooling')
    expect(engagementState(daysAgo(DORMANT_AFTER_DAYS - 1), now)).toBe('cooling')
  })
  it('is dormant from 63 days', () => {
    expect(engagementState(daysAgo(DORMANT_AFTER_DAYS), now)).toBe('dormant')
    expect(engagementState(daysAgo(400), now)).toBe('dormant')
  })
})

describe('rotationAllowedForEngagement', () => {
  it('lets active members have every rotation email', () => {
    expect(rotationAllowedForEngagement('active', 'FINISH_LINE')).toBe(true)
    expect(rotationAllowedForEngagement('active', 'MARKET_UPDATE')).toBe(true)
  })
  it('leaves cooling members only the Monday plan', () => {
    expect(rotationAllowedForEngagement('cooling', 'MORNING_MOTIVATION')).toBe(true)
    expect(rotationAllowedForEngagement('cooling', 'MIDWEEK_CHECKIN')).toBe(false)
    expect(rotationAllowedForEngagement('cooling', 'FINISH_LINE')).toBe(false)
    expect(rotationAllowedForEngagement('cooling', 'MARKET_UPDATE')).toBe(false)
  })
  it('stops everything for dormant members', () => {
    expect(rotationAllowedForEngagement('dormant', 'MORNING_MOTIVATION')).toBe(false)
  })
})

describe('winBackSpacedOut', () => {
  it('allows the first send', () => {
    expect(winBackSpacedOut(null, now)).toBe(true)
  })
  it('blocks a second send inside the minimum gap, so overdue steps are never sent back to back', () => {
    expect(winBackSpacedOut(daysAgo(1), now)).toBe(false)
    expect(winBackSpacedOut(daysAgo(WIN_BACK_MIN_GAP_DAYS - 1), now)).toBe(false)
  })
  it('allows it once the gap has passed', () => {
    expect(winBackSpacedOut(daysAgo(WIN_BACK_MIN_GAP_DAYS), now)).toBe(true)
  })
})
