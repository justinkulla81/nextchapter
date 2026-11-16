import { describe, expect, it } from 'vitest'
import { countSkills } from '@/lib/workforce/skills-dictionary'

describe('countSkills', () => {
  it('counts a posting once per skill and ranks by postings', () => {
    const r = countSkills(['Analyst. SQL, SQL and Excel. Uses generative AI.', 'Manager. Excel and Salesforce.', 'Controller. GAAP, forecasting.'])
    expect(r.find((s) => s.skill === 'SQL')?.postings).toBe(1)
    expect(r[0].skill).toBe('Excel')
    expect(r[0].postings).toBe(2)
    expect(r.find((s) => s.skill === 'AI or generative AI')?.share).toBeCloseTo(1 / 3)
  })
  it('does not match "ai" inside other words', () => {
    expect(countSkills(['We maintain our retail stores and train staff']).length).toBe(0)
  })
  it('returns nothing for no postings', () => {
    expect(countSkills([])).toEqual([])
  })
})
