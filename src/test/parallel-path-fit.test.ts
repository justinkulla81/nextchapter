import { describe, expect, it } from 'vitest'
import { boardRank, matchesParallelPath } from '@/lib/jobs/parallel-path-fit'
import { defaultWorkTypes, pathWorkTypes } from '@/lib/jobs/work-type'

describe('pathWorkTypes / defaultWorkTypes', () => {
  it('shows contract and part-time for flexible-work paths', () => {
    for (const p of ['CONTRACT_1099', 'FRACTIONAL', 'CONSULTING', 'OWN_BUSINESS', 'PART_TIME']) {
      expect(pathWorkTypes([p])).toEqual(['part_time', 'contract'])
    }
  })
  it('does nothing for training, nothing, or no answer', () => {
    expect(pathWorkTypes(['TRAINING'])).toEqual([])
    expect(pathWorkTypes([])).toEqual([])
    expect(pathWorkTypes(null)).toEqual([])
  })
  it('adds them to the defaults, never overriding a saved choice', () => {
    expect(defaultWorkTypes({ parallelPaths: ['CONTRACT_1099'] })).toEqual(['full_time', 'part_time', 'contract'])
    expect(defaultWorkTypes({})).toEqual(['full_time'])
    expect(defaultWorkTypes({ jobBoardWorkTypes: ['full_time'], parallelPaths: ['CONTRACT_1099'] })).toEqual(['full_time'])
  })
})

describe('matchesParallelPath', () => {
  const contract = { title: 'Marketing Consultant (Contract)' }
  const fullTime = { title: 'Director of Marketing' }
  const fractional = { title: 'Fractional CMO' }
  const interim = { title: 'Interim VP Finance' }
  const c2h = { title: 'Accountant - Contract-to-hire' }

  it('matches nothing without paths', () => {
    expect(matchesParallelPath(contract, null)).toBe(false)
    expect(matchesParallelPath(contract, [])).toBe(false)
  })
  it('1099 matches contract work but not full-time, and not contract-to-hire (W-2)', () => {
    expect(matchesParallelPath(contract, ['CONTRACT_1099'])).toBe(true)
    expect(matchesParallelPath(fullTime, ['CONTRACT_1099'])).toBe(false)
    expect(matchesParallelPath(c2h, ['CONTRACT_1099'])).toBe(false)
    expect(matchesParallelPath({ title: 'Analyst', description: 'This is a 6 month contract role, W-2 through our agency.' }, ['CONTRACT_1099'])).toBe(false)
  })
  it('fractional matches fractional and interim roles', () => {
    expect(matchesParallelPath(fractional, ['FRACTIONAL'])).toBe(true)
    expect(matchesParallelPath(interim, ['FRACTIONAL'])).toBe(true)
    expect(matchesParallelPath(fullTime, ['FRACTIONAL'])).toBe(false)
  })
  it('consulting matches contract roles and consulting titles', () => {
    expect(matchesParallelPath(contract, ['CONSULTING'])).toBe(true)
    expect(matchesParallelPath(fullTime, ['CONSULTING'])).toBe(false)
  })
  it('a part-time job path matches part-time roles only', () => {
    expect(matchesParallelPath({ title: 'Part-time Bookkeeper' }, ['PART_TIME'])).toBe(true)
    expect(matchesParallelPath(contract, ['PART_TIME'])).toBe(false)
  })
  it('training matches nothing', () => {
    expect(matchesParallelPath(contract, ['TRAINING'])).toBe(false)
  })
  it('any one matching path is enough', () => {
    expect(matchesParallelPath(fractional, ['CONTRACT_1099', 'FRACTIONAL'])).toBe(true)
  })
})

describe('boardRank', () => {
  it('is unchanged without a match', () => {
    for (const fit of [0, 1, 2]) for (const comp of [0, 1, 2]) expect(boardRank(fit, comp, false)).toBe(fit * 3 + comp)
  })
  it('lifts a match one competition level within its fit level', () => {
    expect(boardRank(1, 2, true)).toBe(boardRank(1, 1, false))
    expect(boardRank(1, 1, true)).toBe(boardRank(1, 0, false))
  })
  it('never lifts a match out of its fit level', () => {
    for (const fit of [0, 1, 2, 3]) for (const comp of [0, 1, 2]) {
      expect(boardRank(fit, comp, true)).toBeGreaterThanOrEqual(fit * 3)
      expect(boardRank(fit, comp, true)).toBeLessThan((fit + 1) * 3)
    }
  })
  it('a strong full-time fit still outranks a stretch contract role that matches', () => {
    expect(boardRank(0, 2, false)).toBeLessThan(boardRank(2, 0, true))
  })
})
