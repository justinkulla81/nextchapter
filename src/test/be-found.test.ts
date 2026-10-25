import { describe, expect, it } from 'vitest'
import { beFoundMode, beFoundPlan } from '@/lib/network/be-found'

describe('Be found', () => {
  it('quiet when confidential mode is on, public otherwise', () => {
    expect(beFoundMode(true)).toBe('quiet')
    expect(beFoundMode(false)).toBe('public')
  })
  it('both modes cover the five ways and the coach offer with its reason', () => {
    for (const m of ['quiet', 'public'] as const) {
      const p = beFoundPlan(m)
      expect(p.steps.map((s) => s.key)).toEqual(['positioning', 'linkedin', 'podcasts', 'speaking', 'articles'])
      expect(p.coach.why.length).toBeGreaterThan(20)
      expect(p.why).toHaveLength(3)
    }
  })
  it('the quiet version never mentions a search or an open-to-work signal except to say leave it off', () => {
    const p = beFoundPlan('quiet')
    const text = [p.intro, ...p.steps.map((s) => s.body)].join(' ')
    expect(text).not.toMatch(/looking for|available|hiring leaders/i)
    expect(text).toMatch(/Leave the "open to work" signal off/)
    expect(text.match(/open to work/gi)).toHaveLength(1)
    expect(text.match(/\bsearch\b/gi)).toHaveLength(1) // only the intro, to say none of it mentions one
  })
  it('sends the speaking step to the conferences catalog in both modes', () => {
    for (const m of ['quiet', 'public'] as const) {
      const step = beFoundPlan(m).steps.find((x) => x.key === 'speaking')!
      expect(step.href).toBe('/dashboard/network/events')
      expect(step.hrefLabel).toBe('Find conferences')
    }
  })
  it('the public version may say what they want next', () => {
    expect(beFoundPlan('public').steps[0].body).toMatch(/what you want next/)
  })
  it('only links to pages that exist, and states no statistic', () => {
    for (const m of ['quiet', 'public'] as const) {
      const p = beFoundPlan(m)
      for (const s of p.steps) if (s.href) expect(['/dashboard/linkedin', '/dashboard/network/events']).toContain(s.href)
      expect(JSON.stringify(p)).not.toMatch(/\d+\s?%|\b\d+x\b/)
    }
  })
})
