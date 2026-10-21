import { describe, it, expect } from 'vitest'
import { demoProfile } from '@/lib/higher-ed/demo-skills'
import { computeCohortAiGap } from '@/lib/skills/cohort-ai-gap'
import { renderToStaticMarkup } from 'react-dom/server'
import { CohortAiGapPanel } from '@/components/skills/CohortAiGapPanel'

describe('demo skills', () => {
  it('is deterministic', () => {
    expect(demoProfile('washjeff', 7)).toEqual(demoProfile('washjeff', 7))
  })

  it('gives a 100-person group an AI-gap story: a minority show an AI skill', () => {
    const members = Array.from({ length: 100 }, (_, i) => {
      const p = demoProfile('washjeff', i)
      return { fn: p.primaryFunction, keywords: p.resumeKeywords }
    })
    const g = computeCohortAiGap(members)!
    expect(g.counted).toBe(100)
    expect(g.showAnyAi).toBeGreaterThan(20)
    expect(g.showAnyAi).toBeLessThan(70)
    expect(g.topMissing.length).toBeGreaterThan(0)
  })
})


describe('AI skills panel', () => {
  const gap = computeCohortAiGap(
    Array.from({ length: 60 }, (_, i) => {
      const p = demoProfile('washjeff', i)
      return { fn: p.primaryFunction, keywords: p.resumeKeywords }
    })
  )

  it('shows counts and the limits for a college-sized group', () => {
    const html = renderToStaticMarkup(CohortAiGapPanel({ gap, who: 'alumni who share outcomes' }))
    expect(html).toContain('AI skills')
    expect(html).toContain('of 60')
    expect(html).toContain('Most often missing')
    expect(html).toContain('can understate what they know')
  })

  it('says why nothing shows under ten people', () => {
    const html = renderToStaticMarkup(CohortAiGapPanel({ gap: null, who: 'alumni who share outcomes' }))
    expect(html).toContain('Shown once at least 10 alumni who share outcomes')
  })
})
