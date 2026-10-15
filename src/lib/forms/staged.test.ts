import { describe, expect, it } from 'vitest'
import { stagedSummary } from './staged'

const steps = [
  { label: 'Your path', minutes: 1 },
  { label: 'Resume', minutes: 2 },
  { label: 'Location', minutes: 1 },
]

describe('stagedSummary', () => {
  it('names the step and the time left', () => {
    expect(stagedSummary(steps, 1)).toBe('Step 2 of 3: Resume. About 3 minutes left.')
  })
  it('says minute, not minutes, when one is left', () => {
    expect(stagedSummary(steps, 2)).toBe('Step 3 of 3: Location. About 1 minute left.')
  })
  it('clamps an out-of-range step', () => {
    expect(stagedSummary(steps, 9)).toBe('Step 3 of 3: Location. About 1 minute left.')
    expect(stagedSummary(steps, -1)).toBe('Step 1 of 3: Your path. About 4 minutes left.')
  })
})
