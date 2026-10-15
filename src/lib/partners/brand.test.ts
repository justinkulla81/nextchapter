import { describe, expect, it } from 'vitest'
import { accentReadableOnWhite, brandStyle, contrastRatio, mergeBrand, normalizeHex } from './brand'

describe('normalizeHex', () => {
  it('accepts with or without a hash and lowercases', () => {
    expect(normalizeHex('#1D6FB8')).toBe('#1d6fb8')
    expect(normalizeHex('1d6fb8')).toBe('#1d6fb8')
  })
  it('rejects anything else', () => {
    for (const bad of ['', '#123', '#12345g', 'red', null, undefined, 12]) expect(normalizeHex(bad)).toBeNull()
  })
})

describe('contrast', () => {
  it('black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
  it('flags very light colors as unreadable on white', () => {
    expect(accentReadableOnWhite('#f4a259')).toBe(false)
    expect(accentReadableOnWhite('#1d4e89')).toBe(true)
  })
})

describe('mergeBrand', () => {
  it('prefers the first valid value for each field', () => {
    const b = mergeBrand({ name: 'Org Brand', accent: 'nope' }, { name: 'Entity', accent: '#7a1f2b', logoUrl: 'https://x.test/l.png' })
    expect(b).toEqual({ name: 'Org Brand', logoUrl: 'https://x.test/l.png', accent: '#7a1f2b' })
  })
  it('rejects non-https logo urls', () => {
    expect(mergeBrand({ logoUrl: 'http://x.test/l.png' }).logoUrl).toBeNull()
    expect(mergeBrand({ logoUrl: 'javascript:alert(1)' }).logoUrl).toBeNull()
  })
  it('returns all null for nothing', () => {
    expect(mergeBrand(null, undefined)).toEqual({ name: null, logoUrl: null, accent: null })
  })
})

describe('brandStyle', () => {
  it('is undefined without an accent', () => {
    expect(brandStyle({ name: 'X', logoUrl: null, accent: null })).toBeUndefined()
  })
  it('sets primary and a readable foreground', () => {
    const s = brandStyle({ name: 'X', logoUrl: null, accent: '#f4a259' }) as Record<string, string>
    expect(s['--primary']).toBe('#f4a259')
    expect(s['--primary-foreground']).toBe('#0a0a0a')
  })
})
