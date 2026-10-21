import { describe, it, expect } from 'vitest'
import { likePremiumRange, liveFunctionRows, liveLevelRows, liveOverallSharePct, overallSharePct, publicFunctionRows, skillGroupsForDisplay } from '@/lib/skills/ai-skills-public'
import { weeklyShareTrend } from '@/lib/skills/ai-market-trend'
import type { AiMarketData } from '@/lib/skills/ai-market'
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


const counts = (fullText: number, ai: number): AiMarketData['counts'] => ({ live: fullText, aiSkill: ai, aiExposed: ai, fullText, twin: 0, excerpt: 0, unread: 0, aiSkillFullText: ai, aiExposedFullText: ai })
const prem = (raw: number, like?: number) => ({ nAi: 60, nBase: 200, medAi: 120000, medBase: 100000, rawUsd: 20000, rawPct: raw, ...(like === undefined ? {} : { likePct: like, likeUsd: 15000, likeN: 80, likeCells: 3 }) })
const live: AiMarketData = {
  asOf: '2026-10-21',
  counts: counts(1000, 120),
  functions: {
    finance: { label: 'Finance', n: 800, aiSkill: 80, aiExposed: 90, sharePct: 10, exposedPct: 11.3, premium: prem(26, 21), levels: { mid: prem(20, 14), senior: prem(30, 22), vp: prem(40) }, topItems: [], topTools: [] },
    legal: { label: 'Legal', n: 400, aiSkill: 4, aiExposed: 4, sharePct: 1, exposedPct: 1, premium: prem(10), levels: { mid: prem(8, 6) }, topItems: [], topTools: [] },
  },
}

describe('live AI market on the public page', () => {
  it('uses premium only when raw and like for like both exist, and drops thin functions', () => {
    const rows = liveFunctionRows(live)
    expect(rows.map((r) => r.fn)).toEqual(['finance']) // legal has 400 postings
    expect(rows[0]).toMatchObject({ sharePct: 10, rawPremiumPct: 26, likePremiumPct: 21 })
    expect(liveOverallSharePct(live)).toBe(12)
  })

  it('lists levels only where both numbers exist, for functions with two or more', () => {
    const lv = liveLevelRows(live)
    expect(lv).toHaveLength(1)
    expect(lv[0].byLevel).toEqual({ mid: 14, senior: 22 }) // vp has no like for like; legal has one level
  })
})

describe('weekly share trend', () => {
  const snap = (iso: string, ai: number) => ({ computedAt: new Date(`${iso}T23:45:00Z`), data: { counts: counts(1000, ai) } })

  it('takes the last snapshot of each week and waits for enough weeks', () => {
    expect(weeklyShareTrend([snap('2026-10-19', 100), snap('2026-10-20', 110), snap('2026-10-26', 120)])).toBeNull()
    const t = weeklyShareTrend([snap('2026-10-19', 100), snap('2026-10-21', 110), snap('2026-10-26', 120), snap('2026-11-02', 130), snap('2026-11-09', 140)])!
    expect(t).toHaveLength(4)
    expect(t[0]).toEqual({ weekOf: '2026-10-19', sharePct: 11 }) // Oct 21's 110 replaces Oct 19's 100
    expect(t[t.length - 1].sharePct).toBe(14)
  })
})
