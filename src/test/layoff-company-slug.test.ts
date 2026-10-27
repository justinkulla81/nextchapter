import { describe, expect, it } from 'vitest'
import { resolveCompanySlug } from '@/lib/warn/layoff-pages'

const known = ['oracle', 'acme-holdings', 'intel', 'delta-air-lines', 'delta-air-cargo']

describe('resolveCompanySlug', () => {
  it('drops a trailing place', () => expect(resolveCompanySlug('acme-holdings-lansing', known)).toBe('acme-holdings'))
  it('keeps an exact slug', () => expect(resolveCompanySlug('intel', known)).toBe('intel'))
  it('drops legal suffixes and follows merged subsidiaries', () => {
    expect(resolveCompanySlug('intel-corporation', known)).toBe('intel')
    expect(resolveCompanySlug('oracle-america', known)).toBe('oracle')
  })
  it('takes a prefix only when exactly one slug matches', () => {
    expect(resolveCompanySlug('acme', known)).toBe('acme-holdings')
    expect(resolveCompanySlug('delta-air', known)).toBeNull()
  })
  it('returns null for an employer with no filings', () => expect(resolveCompanySlug('american-express', known)).toBeNull())
})
