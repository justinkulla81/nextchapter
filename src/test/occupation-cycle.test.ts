import { describe, expect, it } from 'vitest'
import { cycleBand, cycleLineFor, cycleLineForSoc, type CycleEpisode } from '@/lib/pivots/occupation-cycle'

const EP: CycleEpisode[] = [
  { label: '2007 to 2010', allJobsPct: -6 },
  { label: '2019 to 2020', allJobsPct: -7 },
]

describe('occupation cycle', () => {
  it('calls work that fell well below all jobs in both downturns "swings"', () => {
    expect(cycleBand([-15, -20], EP)).toBe('swings')
  })
  it('calls work that beat all jobs in both downturns "held"', () => {
    expect(cycleBand([-3, -4], EP)).toBe('held')
  })
  it('says nothing when the two downturns disagree or the gap is small', () => {
    expect(cycleBand([-15, -5], EP)).toBeNull()
    expect(cycleBand([-7, -8], EP)).toBeNull()
  })
  it('says nothing without two comparable episodes', () => {
    expect(cycleBand([-15], EP.slice(0, 1))).toBeNull()
    expect(cycleBand([-15], EP)).toBeNull()
  })
  it('words it as history, never a forecast or a verdict', () => {
    const line = cycleLineFor([-15, -20], EP)!
    expect(line).toContain('That is what happened before, not a forecast.')
    expect(line).toContain('−15% against −6% for all jobs')
    expect(line).not.toMatch(/\b(safe|risk|recession-proof|will)\b/i)
  })
  it('shows nothing when no history is loaded for an occupation', () => {
    expect(cycleLineForSoc('13-2051.00')).toBeNull()
    expect(cycleLineForSoc(undefined)).toBeNull()
  })
})
