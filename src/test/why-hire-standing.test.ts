import { describe, expect, it } from 'vitest'
import { oneIn, peerStanding, standingMarks } from '@/lib/profile/why-hire-standing'

describe('why hire me standing', () => {
  it('marks what is proven and puts references first', () => {
    const m = standingMarks({ completedReferences: 1, resumeResultsScore: 72, hasPerformance: false, hasTrackRecord: true, hasPitch: false })
    expect(m.map((x) => x.key)).toEqual(['references', 'results', 'measured', 'scale', 'pitch'])
    expect(m.filter((x) => x.done).map((x) => x.key)).toEqual(['results', 'scale'])
    expect(m.find((x) => !x.done)!.step).toBe('Ask one more reference')
  })

  it('compares with peers, leaving the person out of their own bucket', () => {
    // 30 members: 10 with 0 marks, 10 with 2 (including this person), 5 with 4, 5 with all five.
    const s = peerStanding({ 0: 10, 2: 10, 4: 5, 5: 5 }, 2, 5, 'people in operations')!
    expect(s.peers).toBe(29)
    expect(s.aheadOf).toBeCloseTo(10 / 29)
    expect(s.withAll).toBeCloseTo(5 / 29)
  })

  it('says nothing about peers when there are too few', () => {
    expect(peerStanding({ 0: 5, 3: 5 }, 3, 5, 'x')).toBeNull()
    expect(peerStanding(null, 3, 5, 'x')).toBeNull()
  })

  it('says small shares the way people do', () => {
    expect(oneIn(0.04)).toBe('1 in 25')
    expect(oneIn(0.004)).toBe('fewer than 1 in 100')
    expect(oneIn(0)).toBe('almost no one')
  })
})
