import { describe, expect, it } from 'vitest'
import { BACKCHANNEL_STATS, pickBackchannelStat } from '@/lib/email/backchannel-stats'

describe('pickBackchannelStat', () => {
  it('shows a different stat in consecutive emails and cycles', () => {
    const picks = [0, 1, 2, 3].map((n) => pickBackchannelStat(n))
    expect(new Set(picks.slice(0, BACKCHANNEL_STATS.length)).size).toBe(BACKCHANNEL_STATS.length)
    expect(picks[3]).toBe(picks[0])
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1])
  })

  it('gives every stat a source name and link', () => {
    for (const s of BACKCHANNEL_STATS) {
      expect(s.source.length).toBeGreaterThan(0)
      expect(s.url).toMatch(/^https:\/\//)
    }
  })
})
