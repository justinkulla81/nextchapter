import { describe, expect, it } from 'vitest'
import { HERO_STATS } from '@/lib/marketing/hero-stats'

describe('homepage hero stats', () => {
  it('shows four figures', () => {
    expect(HERO_STATS).toHaveLength(4)
  })
  it('balances bright spots and clouds', () => {
    expect(HERO_STATS.filter((s) => s.tone === 'bright-spot')).toHaveLength(2)
    expect(HERO_STATS.filter((s) => s.tone === 'cloud')).toHaveLength(2)
  })
  it('cites every figure with a linkable source and an evidence tag', () => {
    for (const s of HERO_STATS) {
      expect(s.source.length).toBeGreaterThan(0)
      expect(s.sourceUrl).toMatch(/^(https:\/\/|\/)/)
      expect(['P', 'S']).toContain(s.evidence)
    }
  })
  it('does not attribute a pay cut or job loss to AI', () => {
    for (const s of HERO_STATS) expect(`${s.label} ${s.value}`).not.toMatch(/\bAI\b/)
  })
})
