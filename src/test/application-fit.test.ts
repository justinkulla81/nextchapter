import { describe, it, expect } from 'vitest'
import {
  classifyYears,
  classifyApplication,
  aggregateApplicationFit,
  coachingSuggestion,
  countVerdicts,
  shareOf,
  yearsGapBin,
  type ApplyFitMember,
  type ClassifiedApplication,
} from '@/lib/admin/application-fit'
import type { YearsRequirement } from '@/lib/jobs/years-required'

const req = (min: number, max: number | null = null, extra: Partial<YearsRequirement> = {}): YearsRequirement => ({
  min, max, strength: 'required', orEquivalent: false, phrase: '', ...extra,
})

const member = (over: Partial<ApplyFitMember> = {}): ApplyFitMember => ({
  highestLevelReached: 'Director', levelRankScore: null, yearsExperience: 12, isPivoting: false, ...over,
})

describe('classifyYears thresholds', () => {
  it('unknown without a requirement or member years', () => {
    expect(classifyYears(10, null)).toEqual({ fit: 'unknown', gap: null })
    expect(classifyYears(null, req(5))).toEqual({ fit: 'unknown', gap: null })
  })
  it('under by 1 is within', () => {
    expect(classifyYears(9, req(10))).toEqual({ fit: 'within', gap: -1 })
  })
  it('under by 2 is reach, 5 is big reach', () => {
    expect(classifyYears(8, req(10)).fit).toBe('under')
    expect(classifyYears(6, req(10)).fit).toBe('under')
    expect(classifyYears(5, req(10)).fit).toBe('big_under')
  })
  it('preferred / or-equivalent are one year softer', () => {
    expect(classifyYears(8, req(10, null, { strength: 'preferred' })).fit).toBe('within')
    expect(classifyYears(7, req(10, null, { strength: 'preferred' })).fit).toBe('under')
    expect(classifyYears(5, req(10, null, { orEquivalent: true })).fit).toBe('under')
    expect(classifyYears(4, req(10, null, { orEquivalent: true })).fit).toBe('big_under')
  })
  it('range: over by 5+ past the top is overqualified', () => {
    expect(classifyYears(12, req(5, 10))).toEqual({ fit: 'within', gap: 2 })
    expect(classifyYears(15, req(5, 10))).toEqual({ fit: 'over', gap: 5 })
    expect(classifyYears(8, req(5, 10))).toEqual({ fit: 'within', gap: 0 })
  })
  it('no top: 8+ past the minimum is overqualified', () => {
    expect(classifyYears(12, req(5))).toEqual({ fit: 'within', gap: 7 })
    expect(classifyYears(13, req(5))).toEqual({ fit: 'over', gap: 8 })
  })
})

describe('classifyApplication verdicts', () => {
  it('2+ levels up is reaching', () => {
    const r = classifyApplication(member({ highestLevelReached: 'Manager' }), { title: 'Chief Operating Officer', yearsRequired: null })
    expect(r.seniority).toBe('big_up')
    expect(r.verdict).toBe('reaching')
  })
  it('one level up is a healthy stretch', () => {
    const r = classifyApplication(member(), { title: 'Vice President, Marketing', yearsRequired: req(10) })
    expect(r.seniority).toBe('up')
    expect(r.verdict).toBe('on_target')
  })
  it('stretch plus a years reach is reaching', () => {
    const r = classifyApplication(member({ yearsExperience: 8 }), { title: 'Vice President, Marketing', yearsRequired: req(15) })
    expect(r.verdict).toBe('reaching')
  })
  it('same level but too few years is reaching', () => {
    const r = classifyApplication(member({ yearsExperience: 6 }), { title: 'Director of Finance', yearsRequired: req(10) })
    expect(r.seniority).toBe('same')
    expect(r.verdict).toBe('reaching')
  })
  it('same level with more years than asked stays on target', () => {
    const r = classifyApplication(member({ yearsExperience: 25 }), { title: 'Director of Finance', yearsRequired: req(10) })
    expect(r.years.fit).toBe('over')
    expect(r.verdict).toBe('on_target')
  })
  it('2+ levels down is underselling', () => {
    const r = classifyApplication(member({ highestLevelReached: 'VP' }), { title: 'Senior Product Manager', yearsRequired: null })
    expect(r.seniority).toBe('big_down')
    expect(r.verdict).toBe('underselling')
  })
  it('1 down alone is on target; with years overqualified it is underselling', () => {
    const vp = member({ highestLevelReached: 'VP', yearsExperience: 20 })
    expect(classifyApplication(vp, { title: 'Director of Sales', yearsRequired: null }).verdict).toBe('on_target')
    expect(classifyApplication(vp, { title: 'Director of Sales', yearsRequired: req(5, 8) }).verdict).toBe('underselling')
  })
  it('job rung from the board wins over the title', () => {
    const r = classifyApplication(member(), { title: 'Investments', level: 'C_SUITE', yearsRequired: null })
    expect(r.seniority).toBe('big_up')
  })
  it('years overqualified with unknown level is underselling', () => {
    const r = classifyApplication(member({ yearsExperience: 20 }), { title: 'Analyst', yearsRequired: req(2, 4) })
    expect(r.seniority).toBe('unknown')
    expect(r.verdict).toBe('underselling')
  })
  it('nothing to compare is unknown', () => {
    const r = classifyApplication(member(), { title: null, yearsRequired: null })
    expect(r.verdict).toBe('unknown')
    expect(r.reason).toBe('No level or years to compare')
  })
  it('unknown member level and years is unknown', () => {
    const r = classifyApplication(member({ highestLevelReached: null, yearsExperience: null }), { title: 'VP Sales', yearsRequired: req(10) })
    expect(r.verdict).toBe('unknown')
  })
})

describe('pivot handling', () => {
  const pivot = member({ highestLevelReached: 'VP', isPivoting: true, yearsExperience: 22 })
  it('a pivoting member stepping down is explained, not underselling', () => {
    const r = classifyApplication(pivot, { title: 'Senior Product Manager', yearsRequired: req(5) })
    expect(r.seniority).toBe('big_down')
    expect(r.pivotExplained).toBe(true)
    expect(r.verdict).toBe('on_target')
    expect(r.reason).toContain('(pivoting)')
  })
  it('pivoting member with more years than asked is not underselling', () => {
    const r = classifyApplication(pivot, { title: 'Analyst', yearsRequired: req(2, 4) })
    expect(r.verdict).toBe('on_target')
  })
  it('pivoting does not hide a reach', () => {
    const r = classifyApplication({ ...pivot, highestLevelReached: 'Manager' }, { title: 'Chief Executive Officer', yearsRequired: null })
    expect(r.verdict).toBe('reaching')
  })
})

describe('aggregate math', () => {
  const row = (candidateId: string, verdict: 'reaching' | 'on_target' | 'underselling' | 'unknown', gap: number | null = null, level = 'Director', fn = 'Finance'): ClassifiedApplication => ({
    candidateId,
    memberLevel: level,
    memberFunction: fn,
    result: {
      verdict,
      years: { fit: gap === null ? 'unknown' : 'within', gap },
      seniority: verdict === 'reaching' ? 'big_up' : verdict === 'underselling' ? 'big_down' : verdict === 'unknown' ? 'unknown' : 'same',
      pivotExplained: false,
      reason: '',
    },
  })

  it('counts and shares exclude unknown from the denominator', () => {
    const c = countVerdicts(['reaching', 'reaching', 'on_target', 'unknown'])
    expect(c).toEqual({ total: 4, reaching: 2, on_target: 1, underselling: 0, unknown: 1 })
    expect(shareOf(c, 'reaching')).toBeCloseTo(2 / 3)
    expect(shareOf(countVerdicts(['unknown']), 'reaching')).toBe(0)
  })

  it('gap bins', () => {
    expect(yearsGapBin(-7)).toBe('Under 5+')
    expect(yearsGapBin(-2)).toBe('Under 2–4')
    expect(yearsGapBin(-1)).toBe('Within ±1')
    expect(yearsGapBin(1)).toBe('Within ±1')
    expect(yearsGapBin(4)).toBe('Over 2–4')
    expect(yearsGapBin(5)).toBe('Over 5–7')
    expect(yearsGapBin(12)).toBe('Over 8+')
  })

  it('rolls up by level, function, histograms and members with a min sample', () => {
    const rows = [
      row('a', 'reaching', -3), row('a', 'reaching', -6), row('a', 'on_target', 0), row('a', 'unknown'),
      row('b', 'underselling', 9, 'VP', 'Sales'), row('b', 'underselling', 10, 'VP', 'Sales'), row('b', 'on_target', 1, 'VP', 'Sales'),
      row('c', 'reaching'), row('c', 'on_target'), // below min sample
    ]
    const agg = aggregateApplicationFit(rows)
    expect(agg.overall).toEqual({ total: 9, reaching: 3, on_target: 3, underselling: 2, unknown: 1 })
    expect(agg.byLevel.find((l) => l.key === 'VP')?.counts.underselling).toBe(2)
    expect(agg.byFunction[0].key).toBe('Finance')
    expect(agg.yearsKnown).toBe(6)
    expect(Object.fromEntries(agg.yearsGap.map((g) => [g.bin, g.count]))).toEqual({
      'Under 5+': 1, 'Under 2–4': 1, 'Within ±1': 2, 'Over 2–4': 0, 'Over 5–7': 0, 'Over 8+': 2,
    })
    expect(agg.seniority.find((s) => s.step === 'big_up')?.count).toBe(3)
    expect(agg.members.map((m) => m.candidateId)).toEqual(['a', 'b'])
    expect(agg.members[0].reachingShare).toBeCloseTo(2 / 3)

    const byUndersell = aggregateApplicationFit(rows, { sortMembersBy: 'underselling' })
    expect(byUndersell.members[0].candidateId).toBe('b')
    expect(byUndersell.members[0].undersellingShare).toBeCloseTo(2 / 3)
  })
})

describe('coachingSuggestion', () => {
  const m = member({ highestLevelReached: 'Manager', yearsExperience: 8 })
  const up2 = classifyApplication(m, { title: 'Chief Marketing Officer', yearsRequired: null })
  const same = classifyApplication(m, { title: 'Marketing Manager', yearsRequired: null })
  const yrsReach = classifyApplication(m, { title: 'Marketing Manager', yearsRequired: req(15) })
  const down2 = classifyApplication(member({ highestLevelReached: 'VP' }), { title: 'Senior Analyst', yearsRequired: null })

  it('too few to read', () => {
    expect(coachingSuggestion([], false)).toMatch(/No applications/)
    expect(coachingSuggestion([up2, same], false)).toMatch(/too few/)
  })
  it('mostly 2+ levels up', () => {
    const s = coachingSuggestion([...Array(8).fill(up2), same, same], false)
    expect(s).toBe('8 of 10 applications are 2+ levels up — suggest adding stretch-appropriate roles (one level up).')
  })
  it('mostly a years reach', () => {
    expect(coachingSuggestion([yrsReach, yrsReach, yrsReach, same], false)).toMatch(/^3 of 4 applications ask for more years/)
  })
  it('mostly underselling', () => {
    expect(coachingSuggestion([down2, down2, down2, same], false)).toMatch(/^Applying mostly below level/)
  })
  it('on target', () => {
    expect(coachingSuggestion([same, same, same], false)).toMatch(/no change needed/)
  })
  it('pivoting step-downs', () => {
    const pm = member({ highestLevelReached: 'VP', isPivoting: true })
    const d = classifyApplication(pm, { title: 'Senior Analyst', yearsRequired: null })
    expect(coachingSuggestion([d, d, d], true)).toMatch(/consistent with their pivot/)
  })
})
