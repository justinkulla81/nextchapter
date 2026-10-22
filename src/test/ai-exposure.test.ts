import { describe, expect, it } from 'vitest'
import {
  AI_EXPOSURE_SOURCE,
  EXPOSURE_WHY,
  RETRAINING_LINE,
  bandOf,
  exposureFor,
  exposureSentence,
  retrainingNeed,
  scorePercent,
  soc6Of,
  summarizeJobsByExposure,
  type ExposureMap,
} from '@/lib/skills/ai-exposure'

const map: ExposureMap = new Map([
  ['15-1251', { title: 'Computer Programmers', score: 0.7451 }],
  ['13-2011', { title: 'Accountants and Auditors', score: 0.3478 }],
  ['11-1021', { title: 'General and Operations Managers', score: 0.1378 }],
  ['47-2111', { title: 'Electricians', score: 0 }],
])

describe('AI exposure bands', () => {
  it('cuts at 0.30 and 0.10', () => {
    expect(bandOf(0.7451)).toBe('high')
    expect(bandOf(0.3)).toBe('high')
    expect(bandOf(0.2999)).toBe('some')
    expect(bandOf(0.1)).toBe('some')
    expect(bandOf(0.0999)).toBe('little')
    expect(bandOf(0)).toBe('little')
  })
  it('joins an O*NET-SOC code to the 6-digit score', () => {
    expect(soc6Of('13-2011.01')).toBe('13-2011')
    expect(exposureFor('13-2011.01', map)).toMatchObject({ soc6: '13-2011', score: 0.3478, band: 'high' })
    expect(exposureFor('13-2011', map)?.band).toBe('high')
  })
  it('returns null, not a guess, for an occupation that is not measured or has no code', () => {
    expect(exposureFor('13-1082.00', map)).toBeNull()
    expect(exposureFor(null, map)).toBeNull()
    expect(exposureFor('', map)).toBeNull()
  })
})

describe('wording', () => {
  it('never promises safety or predicts loss', () => {
    const all = [EXPOSURE_WHY, ...Object.values(RETRAINING_LINE), ...['high', 'some', 'little'].map((b) => exposureSentence({ soc6: '47-2111', title: 'Electricians', score: b === 'high' ? 0.5 : b === 'some' ? 0.2 : 0, band: b as 'high' }))]
    for (const s of all) expect(s).not.toMatch(/\b(safe|risk|replace[ds]?|will lose|doomed|obsolete)\b/i)
  })
  it('says a zero means nothing observed yet', () => {
    expect(EXPOSURE_WHY).toMatch(/no use seen yet/)
    expect(exposureSentence({ soc6: '47-2111', title: 'Electricians', score: 0, band: 'little' })).toMatch(/little observed/)
  })
  it('credits the source and formats the score as a whole percent', () => {
    expect(AI_EXPOSURE_SOURCE.name).toBe('Anthropic Economic Index')
    expect(scorePercent(0.3478)).toBe('35%')
  })
})

describe('jobs we see, by exposure', () => {
  const rows = [
    { soc6: '15-1251', count: 100 },
    { soc6: '13-2011', count: 50 },
    { soc6: '11-1021', count: 30 },
    { soc6: '47-2111', count: 20 },
    { soc6: '13-1082', count: 40 }, // no score
    { soc6: null, count: 60 }, // no occupation
  ]
  const s = summarizeJobsByExposure(rows, map)
  it('counts only scored postings in the split, and says how much that covers', () => {
    expect(s.total).toBe(300)
    expect(s.measured).toBe(200)
    expect(s.coverage).toBeCloseTo(200 / 300)
    expect(s.counts).toEqual({ high: 150, some: 30, little: 20 })
    expect(s.shares.high).toBeCloseTo(0.75)
    expect(s.shares.some + s.shares.little + s.shares.high).toBeCloseTo(1)
  })
  it('handles nothing at all', () => {
    expect(summarizeJobsByExposure([], map)).toMatchObject({ measured: 0, total: 0, coverage: 0, shares: { high: 0, some: 0, little: 0 } })
  })
})

describe('retraining need', () => {
  it('follows the band, and says unknown when not measured', () => {
    expect(retrainingNeed(exposureFor('15-1251.00', map))).toBe('build_now')
    expect(retrainingNeed(exposureFor('11-1021.00', map))).toBe('build_alongside')
    expect(retrainingNeed(exposureFor('47-2111.00', map))).toBe('optional')
    expect(retrainingNeed(null)).toBe('unknown')
  })
})
