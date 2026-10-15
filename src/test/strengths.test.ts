import { describe, expect, it } from 'vitest'
import { roleLeansOn, scoreStrengths, strengthHeadline, strengthKeys, strengthNotes } from '@/lib/profile/strengths'

describe('strengths', () => {
  it('finds peaks from objective evidence', () => {
    const p = scoreStrengths({
      perf: { execution: 3.9, judgment: 2.2, composure: 3.0, influence: 1.4 },
      perfPercentile: { execution: 0.92, judgment: 0.4, composure: 0.6, influence: 0.1 },
      refs: { count: 2, followThrough: 4.8, presence: 2, superpowers: [] },
      track: { team: 'TWENTY_ONE_TO_FIFTY', budget: 'ONE_M_TO_10M', pnl: 'PNL' },
      picked: ['work_ethic'],
    })
    expect(p.shape).toBe('peaked')
    expect(p.peaks[0].key).toBe('execution')
    expect(p.peaks.map((x) => x.key)).toContain('scale')
    expect(p.weakSpots.map((w) => w.key)).toContain('influence')
    expect(strengthHeadline(p)).toMatch(/gets things done/)
  })
  it('a pick alone never makes a peak; nothing measured = emerging', () => {
    const p = scoreStrengths({ picked: ['clear_communicator', 'team_player', 'fast_learner'] })
    expect(p.peaks).toEqual([])
    expect(p.shape).toBe('emerging')
    expect(scoreStrengths({}).shape).toBe('emerging')
    expect(scoreStrengths({}).missing.length).toBe(4)
  })
  it('roles say what they play to and what they expose', () => {
    expect(roleLeansOn('account_executive')).toContain('influence')
    const n = strengthNotes({ peaks: ['execution'], weak: ['influence'] }, 'account_executive')
    expect(n.exposes).toMatch(/influence/)
    expect(n.delta).toBeLessThan(0)
    expect(strengthNotes({ peaks: ['execution'], weak: [] }, 'project_management').plays).toMatch(/gets things done/)
    expect(strengthKeys(scoreStrengths({})).peaks).toEqual([])
  })
})
