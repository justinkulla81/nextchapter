import { describe, it, expect } from 'vitest'
import { likePremiumRange, overallSharePct, publicFunctionRows, skillGroupsForDisplay } from '@/lib/skills/ai-skills-public'
import { UNLOCK_NUDGES, type RotationContext } from '@/lib/job-search-daily/rotations'

describe('public AI skills table', () => {
  const rows = publicFunctionRows()

  it('sorts by share and leaves out thin functions', () => {
    expect(rows[0].fn).toBe('data_ai')
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].sharePct).toBeGreaterThanOrEqual(rows[i].sharePct)
    expect(rows.every((r) => r.postings >= 500)).toBe(true)
  })

  it('never shows one premium without the other', () => {
    for (const r of rows) {
      expect(r.rawPremiumPct === null).toBe(r.likePremiumPct === null)
      expect(r.likePremiumPct === null).toBe(r.likePremiumUsd === null)
    }
  })

  it('has an overall share between 0 and 100 and a sensible like-for-like range', () => {
    const o = overallSharePct()
    expect(o).toBeGreaterThan(0)
    expect(o).toBeLessThan(100)
    const r = likePremiumRange()!
    expect(r.min).toBeLessThanOrEqual(r.max)
  })

  it('lists the 24 skills in three groups', () => {
    const g = skillGroupsForDisplay()
    expect(g).toHaveLength(3)
    expect(g.flatMap((x) => x.items)).toHaveLength(24)
  })
})

describe('Job Search Daily AI nudge', () => {
  const learnAi = UNLOCK_NUDGES.find((n) => n.id === 'learn-ai')!
  const base: RotationContext = {
    skillsAssessmentDone: false, dossierUnlocked: false, referencesMet: false, gmailConnected: false, calendarConnected: false,
    recruiterDatabaseOptIn: false, trackedCompanyCount: 0, checkedInToday: false, hasOpenTodos: false, topTodo: null, followUpCount: 0,
    newJobCount: 0, aiSkillCount: 0, aiMarketText: null, aiGapLabel: null,
  }

  it('uses the member’s own numbers, and says nothing it cannot back up', () => {
    const text = learnAi.detailFor!({ ...base, aiMarketText: 'In Finance postings, 12% ask for a specific AI skill.', aiGapLabel: 'Prompt design' })!
    expect(text).toContain('12%')
    expect(text).toContain('Prompt design')
    expect(learnAi.detailFor!(base)).toBeNull()
    expect(`${learnAi.detail} ${text}`).not.toMatch(/table stakes|every function/i)
  })

  it('retires once the profile already shows several AI skills', () => {
    expect(learnAi.done!({ ...base, aiSkillCount: 3 })).toBe(true)
    expect(learnAi.done!({ ...base, aiSkillCount: 1 })).toBe(false)
  })
})
