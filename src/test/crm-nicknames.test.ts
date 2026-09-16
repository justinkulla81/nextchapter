import { describe, it, expect } from 'vitest'
import { firstNamesAreEquivalent, firstNameOf, lastNameOf } from '@/lib/crm/nicknames'

describe('firstNamesAreEquivalent', () => {
  it('treats a nickname and its formal name as the same', () => {
    expect(firstNamesAreEquivalent('Art', 'Arthur')).toBe(true)
    expect(firstNamesAreEquivalent('Arthur', 'Art')).toBe(true)
    expect(firstNamesAreEquivalent('Bob', 'Robert')).toBe(true)
    expect(firstNamesAreEquivalent('ART', 'arthur')).toBe(true)
  })
  it('treats an exact match as equivalent', () => {
    expect(firstNamesAreEquivalent('Justin', 'Justin')).toBe(true)
  })
  it('rejects unrelated names, including other nicknames in different groups', () => {
    expect(firstNamesAreEquivalent('Art', 'Andrew')).toBe(false)
    expect(firstNamesAreEquivalent('Don', 'Ron')).toBe(false)
  })
  it('rejects empty input', () => {
    expect(firstNamesAreEquivalent('', 'Arthur')).toBe(false)
  })
})

describe('lastNameOf / firstNameOf', () => {
  it('splits a two-word name', () => {
    expect(firstNameOf('Art Bilger')).toBe('Art')
    expect(lastNameOf('Art Bilger')).toBe('Bilger')
  })
  it('returns null for a single-token name', () => {
    expect(firstNameOf('Madonna')).toBeNull()
    expect(lastNameOf('Madonna')).toBeNull()
  })
  it('uses the final token for a multi-word name', () => {
    expect(lastNameOf('Mary Jane Watson')).toBe('Watson')
  })
})
