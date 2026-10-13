import { describe, expect, it } from 'vitest'
import { computeRoi, fiscalYear, MIN_GROUP, type RoiRow } from '@/lib/higher-ed/roi-math'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const row = (o: Partial<RoiRow>): RoiRow => ({
  decade: '2000s',
  joined: false,
  claimedAt: null,
  usedThisFy: false,
  gaveThisFy: false,
  gaveLastFy: false,
  gaveBeforeLastFy: false,
  firstGiftAt: null,
  giftCentsAfterClaimThisFy: 0,
  gaveThisFyAfterClaim: false,
  ...o,
})
const times = (n: number, o: Partial<RoiRow>) => Array.from({ length: n }, () => row(o))

describe('fiscal year', () => {
  it('starts in the chosen month and is named for the year it ends', () => {
    const fy = fiscalYear(d('2026-10-13'), 7)
    expect([fy.label, fy.start.toISOString().slice(0, 10), fy.end.toISOString().slice(0, 10)]).toEqual(['FY27', '2026-07-01', '2027-07-01'])
    expect(fiscalYear(d('2026-03-01'), 7).label).toBe('FY26')
    expect(fiscalYear(d('2026-10-13'), 7, -1).label).toBe('FY26')
    expect(fiscalYear(d('2026-10-13'), 1).label).toBe('FY26')
  })
})

describe('ROI', () => {
  const joinedAt = d('2026-08-01')
  // 40 users: 20 gave last year (all again), 20 didn't (10 now give).
  const users = [
    ...times(20, { joined: true, claimedAt: joinedAt, usedThisFy: true, gaveLastFy: true, gaveThisFy: true, gaveThisFyAfterClaim: true, firstGiftAt: d('2020-01-01'), giftCentsAfterClaimThisFy: 10_000 }),
    ...times(10, { joined: true, claimedAt: joinedAt, usedThisFy: true, gaveThisFy: true, gaveThisFyAfterClaim: true, firstGiftAt: d('2026-09-01'), giftCentsAfterClaimThisFy: 5_000 }),
    ...times(5, { joined: true, claimedAt: joinedAt, usedThisFy: true, gaveThisFy: true, gaveThisFyAfterClaim: true, gaveBeforeLastFy: true, firstGiftAt: d('2018-01-01'), giftCentsAfterClaimThisFy: 2_000 }),
    ...times(5, { joined: true, claimedAt: joinedAt, usedThisFy: true }),
  ]
  // 100 never joined, same decade: half gave last year (80% again), half didn't (10% now).
  const comparison = [
    ...times(40, { gaveLastFy: true, gaveThisFy: true }),
    ...times(10, { gaveLastFy: true }),
    ...times(5, { gaveThisFy: true }),
    ...times(45, {}),
  ]

  it('counts groups, donors, dollars after joining, new and reactivated donors', () => {
    const r = computeRoi([...users, ...comparison, row({ joined: true, claimedAt: joinedAt })]) // joined but never used: neither group
    expect([r.users, r.comparison, r.usersDonors, r.comparisonDonors]).toEqual([40, 100, 35, 45])
    expect(r.giftCentsAfterClaim).toBe(20 * 10_000 + 10 * 5_000 + 5 * 2_000)
    expect([r.newDonors, r.reactivated]).toEqual([10, 5])
  })

  it('re-weights the comparison to the users mix and computes lift in points', () => {
    const r = computeRoi([...users, ...comparison])
    // Users: 35/40 this year, 20/40 last → +37.5. Comparison re-weighted
    // 50/50: this year 0.5·0.8 + 0.5·0.1 = 0.45, last 0.5 → −5. Lift 42.5.
    expect(r.usersRate).toEqual({ thisFy: 0.875, lastFy: 0.5 })
    expect(r.comparisonRate?.thisFy).toBeCloseTo(0.45)
    expect(r.lift).toBe(42.5)
    expect(r.enough).toBe(true)
  })

  it(`hides lift when either group is under ${MIN_GROUP}`, () => {
    const r = computeRoi([...users.slice(0, 20), ...comparison])
    expect([r.enough, r.lift]).toEqual([false, null])
    expect(r.usersRate).not.toBeNull()
  })
})
