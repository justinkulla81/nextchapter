import { describe, expect, it } from 'vitest'
import { OVERLAP_SNAPSHOT, functionOverlap, overlapNote } from '@/lib/journey/onet-overlap'
import { pivotTier } from '@/lib/journey/feasibility'
import { buildPathway } from '@/lib/journey/pathway'

const COVERED = ['Operations', 'Marketing', 'Finance', 'Sales', 'Engineering', 'Design', 'Human Resources', 'Legal', 'Data & Analytics']

describe('O*NET overlap against the hand-written feasibility table', () => {
  it('is symmetric and covers each pair once', () => {
    expect(functionOverlap('Finance', 'Sales')).toBe(functionOverlap('Sales', 'Finance'))
    expect(functionOverlap('Finance', 'Product')).toBeNull()
    expect(OVERLAP_SNAPSHOT.onetVersion).toBe('29.3')
  })
  it('no natural move shares little, and no rebuild shares a lot', () => {
    for (const a of COVERED) {
      for (const b of COVERED) {
        if (a === b) continue
        const score = functionOverlap(a, b)
        expect(score, `${a}|${b}`).not.toBeNull()
        const tier = pivotTier(a, b)
        if (tier === 'ADJACENT') expect(score!, `${a} to ${b} is marked a natural move`).toBeGreaterThanOrEqual(0.15)
        if (tier === 'REBUILD') expect(score!, `${a} to ${b} is marked a rebuild`).toBeLessThan(0.3)
      }
    }
  })
  it('words a low overlap as a plan, not a warning', () => {
    const n = overlapNote('Operations', 'Engineering')
    expect(n?.band).toBe('LITTLE')
    expect(n?.text).toMatch(/learning plan/)
    expect(n?.text).not.toMatch(/hard|impossible|unlikely/i)
  })
  it('reaches the pathway', () => {
    expect(buildPathway('Marketing', 'Sales')?.overlap?.band).toBe('MUCH')
    expect(buildPathway('Marketing', 'Product')?.overlap).toBeNull()
  })
})
