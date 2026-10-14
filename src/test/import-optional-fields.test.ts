import { describe, expect, it } from 'vitest'
import { importOptionalFields, importToken } from '@/lib/jobs/import-optional-fields'

describe('import optional one-board fields', () => {
  it('returns only the fields the sender included', () => {
    expect(importOptionalFields({})).toEqual({})
    expect(importOptionalFields({ employmentType: 'Full-Time', payPeriod: 'hour' })).toEqual({ employmentType: 'full_time', payPeriod: 'hour' })
    expect(importOptionalFields({ workArrangement: null })).toEqual({ workArrangement: null })
  })
  it('drops junk values', () => {
    expect(importToken('<script>')).toBeNull()
    expect(importToken(42)).toBeNull()
    expect(importToken('equity_only')).toBe('equity_only')
  })
})
