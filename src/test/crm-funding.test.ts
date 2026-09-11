import { describe, it, expect } from 'vitest'
import { funderKindFrom, valueTypesFrom, usStateFrom, preconditionPenalty, parseHeadcount } from '@/lib/crm/funding'

describe('funderKindFrom', () => {
  it.each([
    ['VC — AgeTech/Longevity', 'Primetime Partners', 'INVESTMENT_FIRM'],
    ['Angel — Investor', 'Caribou Honig (individual)', 'INDIVIDUAL_INVESTOR'],
    ['Federal', 'National Science Foundation', 'GRANT'],
    ['Cloud/Software Credits', 'Amazon Web Services', 'CORPORATE_PROGRAM'],
    ['Accelerator/Challenge', 'Techstars', 'ACCELERATOR'],
  ])('%s -> %s', (cat, org, expected) => {
    expect(funderKindFrom(cat, org)).toBe(expected)
  })
  it('returns null rather than guessing when the category says nothing', () => {
    expect(funderKindFrom('', '')).toBeNull()
  })
})

describe('valueTypesFrom', () => {
  it('reads several kinds of value from one description', () => {
    const v = valueTypesFrom('$2,000 AWS credits + training, technical support, community', null)
    expect(v).toContain('CREDITS')
    expect(v).toContain('CASH')
    expect(v).toContain('ADVISORY')
  })
  it('separates pure credits from cash', () => {
    expect(valueTypesFrom('Up to $350K GCP for AI startups', null)).toContain('CASH')
    expect(valueTypesFrom('No cash; ECOSYSTEM KEY — unlocks partner paths', null)).not.toContain('CREDITS')
  })
})

describe('usStateFrom', () => {
  it.each([
    ['New York, NY', 'NY'],
    ['New Jersey', 'NJ'],
    ['La Jolla / San Diego, CA', 'CA'],
    ['Washington, DC', 'DC'],
    ['National / global', 'NATIONAL'],
  ])('%s -> %s', (input, expected) => {
    expect(usStateFrom(input)).toBe(expected)
  })
  it('treats "national" as a real answer, not a missing one', () => {
    // Most of the funding list is not state-bound; conflating "anywhere" with
    // "unknown" would hide it behind an empty filter.
    expect(usStateFrom('National')).toBe('NATIONAL')
  })
  it('returns null when there is genuinely nothing to read', () => {
    expect(usStateFrom(null)).toBeNull()
    expect(usStateFrom('Somewhere vague')).toBeNull()
  })
})

describe('preconditionPenalty', () => {
  it('costs nothing when nothing stands in the way', () => {
    expect(preconditionPenalty(null)).toBe(0)
    expect(preconditionPenalty(0)).toBe(0)
  })
  it('scales with how long the precondition takes', () => {
    expect(preconditionPenalty(30)).toBeLessThan(preconditionPenalty(180))
  })
  it('caps, so a long runway discounts rather than disqualifies', () => {
    expect(preconditionPenalty(3650)).toBe(0.6)
  })
})

describe('parseHeadcount', () => {
  it.each([
    ['4,800', 4800],
    ['290', 290],
    ['86+', 86],
    ['~800 (est., unconfirmed)', 800],
    // The two that shipped wrong: stripping every non-digit made these
    // 100018 and 2 respectively.
    ['~1,000 (18%)', 1000],
    ['Hundreds (~2%)', null],
    ['Unspecified', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(parseHeadcount(input)).toBe(expected)
  })
  it('rejects an implausible figure rather than storing it', () => {
    expect(parseHeadcount('9,999,999')).toBeNull()
  })
})
