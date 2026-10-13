import { describe, it, expect } from 'vitest'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { safeNext } from '@/lib/auth/safe-next'
import { neutralizeFormula } from '@/lib/admin/csv-export'

describe('isBearerAuthorized', () => {
  const secret = 'a-sufficiently-long-secret'
  it('accepts the exact bearer value', () => {
    expect(isBearerAuthorized(`Bearer ${secret}`, secret)).toBe(true)
  })
  it('fails closed when the secret is unset, empty or short', () => {
    expect(isBearerAuthorized('Bearer undefined', undefined)).toBe(false)
    expect(isBearerAuthorized('Bearer ', '')).toBe(false)
    expect(isBearerAuthorized('Bearer short', 'short')).toBe(false)
  })
  it('rejects missing or wrong headers', () => {
    expect(isBearerAuthorized(null, secret)).toBe(false)
    expect(isBearerAuthorized(`Bearer ${secret}x`, secret)).toBe(false)
    expect(isBearerAuthorized(secret, secret)).toBe(false)
  })
})

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/dashboard/network?x=1', '/d')).toBe('/dashboard/network?x=1')
  })
  it('rejects off-site and protocol-relative targets', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/a://b', '/x\n/y', '']) {
      expect(safeNext(bad, '/d')).toBe('/d')
    }
    expect(safeNext(null, '/d')).toBe('/d')
  })
})

describe('neutralizeFormula', () => {
  it('prefixes formula triggers', () => {
    expect(neutralizeFormula('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(neutralizeFormula('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(neutralizeFormula('-cmd|calc')).toBe(`'-cmd|calc`)
  })
  it('leaves normal text, numbers and phone numbers alone', () => {
    expect(neutralizeFormula('Jane Doe')).toBe('Jane Doe')
    expect(neutralizeFormula('-12.5')).toBe('-12.5')
    expect(neutralizeFormula('+1 (555) 123-4567')).toBe('+1 (555) 123-4567')
  })
})
