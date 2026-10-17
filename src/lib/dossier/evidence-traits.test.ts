import { describe, expect, it } from 'vitest'
import { buildEvidenceTraits, type TraitSignals } from './evidence-traits'

const none: TraitSignals = {
  effortMinutes: 0, profileSections: 0, tailoredApplications: 0, workSamples: 0, goalStreakWeeks: 0,
  helpfulPosts: 0, outreachCount: 0, completedReferences: 0, behavioralAssessments: 0, skillsAssessmentDone: false,
}
const level = (s: TraitSignals, key: string) => buildEvidenceTraits(s).find((t) => t.key === key)!.level

describe('buildEvidenceTraits', () => {
  it('starts every trait at not shown yet', () => {
    expect(buildEvidenceTraits(none).every((t) => t.level === 0)).toBe(true)
    expect(buildEvidenceTraits(none)).toHaveLength(9)
  })
  it('reads motivation from effort minutes', () => {
    expect(level({ ...none, effortMinutes: 20 }, 'motivation')).toBe(1)
    expect(level({ ...none, effortMinutes: 200 }, 'motivation')).toBe(2)
    expect(level({ ...none, effortMinutes: 480 }, 'motivation')).toBe(3)
  })
  it('needs both a reference and an assessment for self-awareness to be emerging', () => {
    expect(level({ ...none, completedReferences: 1 }, 'selfAware')).toBe(0)
    expect(level({ ...none, skillsAssessmentDone: true }, 'selfAware')).toBe(1)
    expect(level({ ...none, completedReferences: 1, skillsAssessmentDone: true }, 'selfAware')).toBe(2)
  })
})
