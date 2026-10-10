import { describe, it, expect } from 'vitest'
import { coerceOption } from '@/lib/resume/extract-profile-fields'

const FUNCTIONS = ['Operations', 'Marketing', 'Customer Success', 'Data & Analytics', 'Executive Leadership'] as const
const LEVELS = ['HIGH_SCHOOL', 'BACHELORS', 'MBA', 'MASTERS'] as const

describe('coerceOption', () => {
  it('maps the model\'s wording onto the allowed list, ignoring case and punctuation', () => {
    expect(coerceOption('operations', FUNCTIONS)).toBe('Operations')
    expect(coerceOption('Customer-Success', FUNCTIONS)).toBe('Customer Success')
    expect(coerceOption('data and analytics', FUNCTIONS)).toBeNull() // "and" != "&": no guessing
    expect(coerceOption('Data & Analytics', FUNCTIONS)).toBe('Data & Analytics')
    expect(coerceOption('high school', LEVELS)).toBe('HIGH_SCHOOL')
  })

  it('returns null — never throws — for a value outside the list, so one field costs one field', () => {
    expect(coerceOption('Strategy', FUNCTIONS)).toBeNull()
    expect(coerceOption('', FUNCTIONS)).toBeNull()
    expect(coerceOption(null, FUNCTIONS)).toBeNull()
    expect(coerceOption(undefined, LEVELS)).toBeNull()
  })
})
