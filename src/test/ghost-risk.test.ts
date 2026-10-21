import { describe, it, expect } from 'vitest'
import { ghostRisk, repostKey, stillListedDirect, STILL_LISTED_DAYS } from '@/lib/jobs/ghost-risk'

describe('ghostRisk', () => {
  it('leaves a fresh, first-time posting alone', () => {
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 5 }).level).toBe('none')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 45 }).level).toBe('none')
  })

  it('treats a role posted and closed twice before as an evergreen listing', () => {
    const v = ghostRisk({ priorClosedCount: 2, ageDays: 3 })
    expect(v.level).toBe('likely')
    expect(v.reason).toMatch(/closed 2 times/)
  })

  it('treats a job open past 90 days as likely; open past 60 days or reposted once as watch', () => {
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 120 }).level).toBe('likely')
    expect(ghostRisk({ priorClosedCount: 1, ageDays: 70 }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 1, ageDays: 10 }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 61 }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 60 }).level).toBe('none')
  })
})

describe('ghostRisk: a direct listing the employer still lists (owner\'s rule 2026-10-19)', () => {
  it('never calls it likely on age alone — at most watch', () => {
    const v = ghostRisk({ priorClosedCount: 0, ageDays: 200, stillListed: true })
    expect(v.level).toBe('watch')
    expect(v.reason).toMatch(/Open for 200 days — still listed by the employer/)
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 90.5, stillListed: true }).level).toBe('watch')
  })

  it('leaves the 60 / 90-day watch and none bands as they were', () => {
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 45, stillListed: true }).level).toBe('none')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 61, stillListed: true }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 1, ageDays: 10, stillListed: true }).level).toBe('watch')
  })

  it('still reaches likely when age combines with another signal', () => {
    const reposted = ghostRisk({ priorClosedCount: 1, ageDays: 120, stillListed: true })
    expect(reposted.level).toBe('likely')
    expect(reposted.reason).toMatch(/Open for 120 days, and closed and reposted once before/)
    const flagged = ghostRisk({ priorClosedCount: 0, ageDays: 120, memberFlags: 2, stillListed: true })
    expect(flagged.level).toBe('likely')
    expect(flagged.reason).toMatch(/2 members flagged/)
    // a member flag without the age is still only watch
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 30, memberFlags: 1, stillListed: true }).level).toBe('watch')
  })

  it('keeps repeated reposts and admin confirmation likely at any age', () => {
    expect(ghostRisk({ priorClosedCount: 2, ageDays: 3, stillListed: true }).level).toBe('likely')
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 0, adminConfirmed: true, stillListed: true }).level).toBe('likely')
  })

  it('keeps aggregator (not still-listed) listings on the plain age rule', () => {
    const v = ghostRisk({ priorClosedCount: 0, ageDays: 120, stillListed: false })
    expect(v.level).toBe('likely')
    expect(v.reason).toBe('Open for 120 days without closing')
  })
})

describe('stillListedDirect', () => {
  const NOW = Date.UTC(2026, 9, 19)
  const DAY = 86_400_000
  it('needs a direct listing confirmed within STILL_LISTED_DAYS', () => {
    expect(STILL_LISTED_DAYS).toBe(8)
    expect(stillListedDirect(true, new Date(NOW - 2 * DAY), NOW)).toBe(true)
    expect(stillListedDirect(true, NOW - STILL_LISTED_DAYS * DAY, NOW)).toBe(true)
    expect(stillListedDirect(true, NOW - STILL_LISTED_DAYS * DAY - 1, NOW)).toBe(false)
    expect(stillListedDirect(true, null, NOW)).toBe(false)
    expect(stillListedDirect(false, new Date(NOW), NOW)).toBe(false)
    expect(stillListedDirect(undefined, new Date(NOW), NOW)).toBe(false)
  })
})

describe('repostKey', () => {
  it('is the same role at the same place, ignoring case and spacing', () => {
    expect(repostKey('Ulta Beauty', ' Sales  Manager ', 'Austin, TX')).toBe(repostKey('ulta beauty', 'sales manager', 'austin,  tx'.replace('  ', ' ')))
  })
  it('keeps different locations apart, so a chain\'s store roles are not "reposts" of each other', () => {
    expect(repostKey('Ulta', 'Sales Manager', 'Austin, TX')).not.toBe(repostKey('Ulta', 'Sales Manager', 'Boise, ID'))
  })
})
