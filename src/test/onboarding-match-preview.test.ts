import { describe, expect, it, vi } from 'vitest'

// match-preview imports the matching engine (database); only the pure helper is under test.
vi.mock('@/lib/personalization/match-compute', () => ({ computeMatchState: vi.fn() }))

import { overridesChangeNothing } from '@/lib/onboarding/match-preview'

describe('overridesChangeNothing', () => {
  const stored = { primaryFunction: 'Marketing', highestLevelReached: 'Director', targetRoleType: null }

  it('is true when every answer on screen is what is already stored (a résumé-filled form)', () => {
    expect(overridesChangeNothing(stored, { primaryFunction: 'Marketing', highestLevelReached: 'Director' })).toBe(true)
  })

  it('is true for no overrides at all', () => {
    expect(overridesChangeNothing(stored, {})).toBe(true)
  })

  it('is false once one answer differs, so the stored profile needs its own count', () => {
    expect(overridesChangeNothing(stored, { primaryFunction: 'Marketing', highestLevelReached: 'VP' })).toBe(false)
  })

  it('is false for an answer where nothing is stored yet', () => {
    expect(overridesChangeNothing(stored, { targetRoleType: 'Head of Growth' })).toBe(false)
  })
})
