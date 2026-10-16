import { describe, expect, it } from 'vitest'
import { computeDirectnessLevel } from '@/lib/scoring/directness-level'

describe('feedback tone preference', () => {
  it('changes nothing when no preference was given', () => {
    expect(computeDirectnessLevel(2, false)).toBe('provisional')
    expect(computeDirectnessLevel(14, false)).toBe('reckoning')
  })
  it('tough love is direct from the start, even for a casual searcher', () => {
    expect(computeDirectnessLevel(1, false, 'TOUGH_LOVE')).toBe('direct')
    expect(computeDirectnessLevel(1, true, 'TOUGH_LOVE')).toBe('direct')
    expect(computeDirectnessLevel(14, false, 'TOUGH_LOVE')).toBe('reckoning')
  })
  it('gentle encouragement never goes past direct', () => {
    expect(computeDirectnessLevel(6, false, 'GENTLE_ENCOURAGEMENT')).toBe('direct')
    expect(computeDirectnessLevel(10, false, 'GENTLE_ENCOURAGEMENT')).toBe('direct')
    expect(computeDirectnessLevel(14, false, 'GENTLE_ENCOURAGEMENT')).toBe('direct')
    expect(computeDirectnessLevel(2, false, 'GENTLE_ENCOURAGEMENT')).toBe('provisional')
  })
  it('a mix follows tenure', () => {
    expect(computeDirectnessLevel(10, false, 'SOMEWHERE_IN_BETWEEN')).toBe('straight')
  })
})
