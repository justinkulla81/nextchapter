import { describe, it, expect } from 'vitest'
import { ghostRisk, repostKey } from '@/lib/jobs/ghost-risk'

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

  it('treats a job open past 90 days as likely, 60 days with a prior closure as watch', () => {
    expect(ghostRisk({ priorClosedCount: 0, ageDays: 120 }).level).toBe('likely')
    expect(ghostRisk({ priorClosedCount: 1, ageDays: 70 }).level).toBe('watch')
    expect(ghostRisk({ priorClosedCount: 1, ageDays: 10 }).level).toBe('none')
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
