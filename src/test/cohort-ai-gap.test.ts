import { describe, it, expect } from 'vitest'
import { computeCohortAiGap, cohortAiGapHeadline, MIN_COHORT, type CohortMember } from '@/lib/skills/cohort-ai-gap'
import { suggestedAiItems } from '@/lib/skills/ai-skill-market'
import { aiSkillItem } from '@/lib/skills/ai-skills'

const people = (n: number, fn: string | null, keywords: string[]): CohortMember[] => Array.from({ length: n }, () => ({ fn, keywords }))

describe('computeCohortAiGap', () => {
  it('holds back below the minimum cohort', () => {
    expect(computeCohortAiGap(people(MIN_COHORT - 1, 'data_ai', []))).toBeNull()
  })

  it('does not count people without a function the analysis covers', () => {
    expect(computeCohortAiGap([...people(MIN_COHORT - 1, 'data_ai', []), ...people(20, null, []), ...people(5, 'not-a-function', [])])).toBeNull()
  })

  it('counts people who show no AI skill and names the most-missing skills', () => {
    const g = computeCohortAiGap(people(12, 'data_ai', ['excel']))!
    expect(g.counted).toBe(12)
    expect(g.showAnyAi).toBe(0)
    expect(g.missingAsked).toBe(12)
    expect(g.topMissing.length).toBeGreaterThan(0)
    expect(g.topMissing.every((m) => m.people >= MIN_COHORT)).toBe(true)
    expect(cohortAiGapHeadline(g)).toContain('100%')
  })

  it('does not call a skill missing when the profile shows it', () => {
    const asked = suggestedAiItems('data_ai', [], 3)
    const alias = aiSkillItem(asked[0])!.aliases[0]
    const g = computeCohortAiGap(people(12, 'data_ai', [alias]))!
    expect(g.showAnyAi).toBe(12)
    expect(g.topMissing.map((m) => m.id)).not.toContain(asked[0])
  })

  it('returns no group smaller than the minimum in the function list', () => {
    const g = computeCohortAiGap([...people(12, 'data_ai', []), ...people(3, 'finance', [])])!
    expect(g.functions.map((f) => f.fn)).toEqual(['data_ai'])
  })
})
