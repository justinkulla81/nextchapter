import { describe, it, expect } from 'vitest'
import { scoreCollege } from '@/lib/workforce/college-score'

const base = { sector: 1, carnegie: 16, size: 4, admitRate: 0.6, interestSignals: [] as string[], contacts: [], areaJobsLost: 0 }
const rich = { alumni: 250_000, expenses: 2e9, endowment: 5e9, privateGifts: 4e8, earnings10: 70_000, employedShare10: 0.7, hasExecEd: true, hasRetraining: true }
const poor = { alumni: 3_000, expenses: 12e6, endowment: null, privateGifts: null, earnings10: null, employedShare10: null, hasExecEd: false, hasRetraining: false }

describe('college score with facts', () => {
  it('is unchanged when no facts are supplied', () => {
    expect(scoreCollege(base).parts.profile).toBeUndefined()
    expect(scoreCollege({ ...base, profile: null }).score).toBe(scoreCollege(base).score)
  })
  it('rewards a large, well-funded college with programs, and stays within 100 before relationship', () => {
    const big = scoreCollege({ ...base, profile: rich })
    const small = scoreCollege({ ...base, profile: poor })
    expect(big.score).toBeGreaterThan(small.score + 10)
    expect(big.score).toBeLessThanOrEqual(100)
    expect(big.parts.notes.join(' ')).toMatch(/executive-education/)
  })
  it('does not treat unknown program flags as yes', () => {
    const yes = scoreCollege({ ...base, profile: { ...rich, hasExecEd: true } }).score
    const unknown = scoreCollege({ ...base, profile: { ...rich, hasExecEd: null } }).score
    const no = scoreCollege({ ...base, profile: { ...rich, hasExecEd: false } }).score
    expect(yes).toBeGreaterThan(unknown)
    expect(unknown).toBeGreaterThan(no)
  })
})
