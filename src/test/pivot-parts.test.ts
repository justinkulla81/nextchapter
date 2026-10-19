import { describe, expect, it } from 'vitest'
import { isPivotingProfile, pivotFlagDrift, pivotTargetOf, pivotTargetWrite } from '@/lib/journey/pivot-target'
import {
  PIVOT_PARTS,
  POSITIVE_FEELING_LABEL,
  POSITIVE_STANCE_LABEL,
  POSITIVE_TIER_LABEL,
  parsePivotPart,
  pivotPartHref,
  transferFacts,
} from '@/lib/journey/pivot-parts'
import { PIVOT_FEELINGS, PIVOT_STANCES } from '@/lib/journey/pivot'

describe('one source of truth for the pivot target', () => {
  it('the target function is the truth, and one equal to their own function is not a move', () => {
    expect(pivotTargetOf({ targetFunction: 'Product', primaryFunction: 'Finance' })).toBe('Product')
    expect(pivotTargetOf({ targetFunction: ' finance ', primaryFunction: 'Finance' })).toBeNull()
    expect(pivotTargetOf({ targetFunction: null, primaryFunction: 'Finance' })).toBeNull()
    expect(pivotTargetOf({ targetFunction: '  ', primaryFunction: null })).toBeNull()
  })

  it('is pivoting with a different target, or on the Changing careers journey before a target is named', () => {
    expect(isPivotingProfile({ targetFunction: 'Product', primaryFunction: 'Finance' })).toBe(true)
    expect(isPivotingProfile({ targetFunction: null, primaryFunction: 'Finance', journey: 'CAREER_CHANGE' })).toBe(true)
    expect(isPivotingProfile({ targetFunction: null, primaryFunction: 'Finance', journey: 'LAID_OFF' })).toBe(false)
    expect(isPivotingProfile({ targetFunction: 'Finance', primaryFunction: 'Finance' })).toBe(false)
  })

  it('writes the target and the older flag together, so older readers keep working', () => {
    expect(pivotTargetWrite('Design')).toEqual({ targetFunction: 'Design', isPivoting: true })
    expect(pivotTargetWrite(null)).toEqual({ targetFunction: null, isPivoting: false })
    expect(pivotTargetWrite('  ')).toEqual({ targetFunction: null, isPivoting: false })
    // Someone on the Changing careers journey who clears a target is still changing careers.
    expect(pivotTargetWrite(null, { keepFlag: true })).toEqual({ targetFunction: null })
  })

  it('finds where the stored flag and the target disagree', () => {
    expect(pivotFlagDrift({ targetFunction: 'Design', primaryFunction: 'Finance', isPivoting: true })).toBe('none')
    expect(pivotFlagDrift({ targetFunction: null, primaryFunction: 'Finance', isPivoting: true })).toBe('flag_without_target')
    expect(pivotFlagDrift({ targetFunction: 'Design', primaryFunction: 'Finance', isPivoting: false })).toBe('target_without_flag')
    expect(pivotFlagDrift({ targetFunction: null, primaryFunction: 'Finance', journey: 'CAREER_CHANGE', isPivoting: true })).toBe('none')
  })
})

describe('the three parts', () => {
  it('are now, go and plan, in that order, defaulting to now', () => {
    expect(PIVOT_PARTS.map((p) => p.key)).toEqual(['now', 'go', 'plan'])
    expect(parsePivotPart(undefined)).toBe('now')
    expect(parsePivotPart('nonsense')).toBe('now')
    expect(parsePivotPart('go')).toBe('go')
    expect(parsePivotPart(['plan', 'go'])).toBe('plan')
  })
  it('each part is its own address', () => {
    expect(pivotPartHref('plan')).toBe('/dashboard/pivot-paths?part=plan')
    expect(pivotPartHref('go', { target: 'Product' })).toBe('/dashboard/pivot-paths?part=go&target=Product')
  })
})

describe('positive wording', () => {
  it('covers every stored key, so nothing falls back to the old words', () => {
    for (const f of PIVOT_FEELINGS) expect(POSITIVE_FEELING_LABEL[f.key]).toBeTruthy()
    for (const s of PIVOT_STANCES) expect(POSITIVE_STANCE_LABEL[s.key]).toBeTruthy()
    expect(Object.keys(POSITIVE_TIER_LABEL).sort()).toEqual(['ADJACENT', 'BRIDGE', 'LEVEL_GATED', 'LICENSED', 'REBUILD', 'SAME'])
  })
  it('has no fear words, no "bigger change" and no "not for me"', () => {
    const all = [...Object.values(POSITIVE_FEELING_LABEL), ...Object.values(POSITIVE_STANCE_LABEL), ...Object.values(POSITIVE_TIER_LABEL)].join(' | ')
    expect(all).not.toMatch(/nervous|scared|not sure|bigger change|not for me|needs a license/i)
  })
})

describe('transferFacts', () => {
  it('lists what carries over, each with where it came from', () => {
    const t = transferFacts({
      from: 'Finance',
      level: 'Director',
      yearsExperience: 18,
      skills: ['forecasting', 'Forecasting', 'budgeting', ' '],
      ownedFunctions: ['Operations', 'Finance'],
      industries: ['Healthcare', 'healthcare', 'Insurance'],
    })
    expect(t.headline).toBe('What you can take with you from Finance')
    expect(t.rows.map((r) => r.label)).toEqual(['Skills you already use', 'Other functions you have run', 'Industries you know', 'The level you bring'])
    expect(t.rows[0].value).toBe('forecasting, budgeting')
    expect(t.rows[1].value).toBe('Operations')
    expect(t.rows[2].value).toBe('Healthcare, Insurance')
    expect(t.rows[3].value).toBe('Director, 18 years of experience')
    for (const r of t.rows) expect(r.why.length).toBeGreaterThan(10)
  })
  it('says nothing it cannot back up', () => {
    const t = transferFacts({ from: null, level: null, yearsExperience: null, skills: [], ownedFunctions: [], industries: [] })
    expect(t.headline).toBe('What you can take with you')
    expect(t.rows).toEqual([])
  })
})
