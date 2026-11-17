import { describe, expect, it } from 'vitest'
import { brandOwnerKey, cleanBrandText } from '@/lib/employer/brand-shared'

describe('employer brand', () => {
  it('lives on the company when there is one, so every section of that company shares it', () => {
    expect(brandOwnerKey({ companyId: 'co1', employerProfileId: 'ep1' })).toBe('company:co1')
    expect(brandOwnerKey({ companyId: 'co1', outplacementOrgId: 'oo1' })).toBe('company:co1')
  })
  it('falls back to the hiring profile or the outplacement org', () => {
    expect(brandOwnerKey({ companyId: null, employerProfileId: 'ep1' })).toBe('employer:ep1')
    expect(brandOwnerKey({ outplacementOrgId: 'oo1' })).toBe('outplacement:oo1')
    expect(brandOwnerKey({})).toBeNull()
  })
  it('cleans text: blank clears, long is refused', () => {
    expect(cleanBrandText('  Build   better  ', 120)).toBe('Build better')
    expect(cleanBrandText('   ', 120)).toBeNull()
    expect(cleanBrandText(null, 120)).toBeNull()
    expect(cleanBrandText('x'.repeat(121), 120)).toBeUndefined()
  })
})
