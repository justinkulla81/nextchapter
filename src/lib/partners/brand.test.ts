import { describe, expect, it } from 'vitest'
import { accentReadableOnWhite, backgroundTokens, brandStyle, contrastRatio, mergeBrand, mixColors, normalizeHex } from './brand'

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
    expect(b).toEqual({ name: 'Org Brand', logoUrl: 'https://x.test/l.png', accent: '#7a1f2b', secondary: null, background: null })
  })
  it('rejects non-https logo urls', () => {
    expect(mergeBrand({ logoUrl: 'http://x.test/l.png' }).logoUrl).toBeNull()
    expect(mergeBrand({ logoUrl: 'javascript:alert(1)' }).logoUrl).toBeNull()
  })
  it('returns all null for nothing', () => {
    expect(mergeBrand(null, undefined)).toEqual({ name: null, logoUrl: null, accent: null, secondary: null, background: null })
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

describe('secondary and background colors', () => {
  it('merges them like the primary', () => {
    const b = mergeBrand({ secondary: 'bad', background: '#101820' }, { secondary: '#c8963e', background: '#ffffff' })
    expect(b.secondary).toBe('#c8963e')
    expect(b.background).toBe('#101820')
  })
  it('mixes colors', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixColors('#123456', '#ffffff', 0)).toBe('#123456')
  })
  it('keeps text readable on any chosen background', () => {
    for (const bg of ['#ffffff', '#000000', '#101820', '#f4e9d8', '#7a1f2b', '#808080']) {
      const t = backgroundTokens(bg)
      expect(contrastRatio(t['--background'], t['--foreground'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t['--card'], t['--card-foreground'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t['--background'], t['--muted-foreground'])).toBeGreaterThanOrEqual(3)
    }
  })
  it('sets only the variables that were chosen', () => {
    const style = brandStyle({ name: null, logoUrl: null, accent: null, secondary: '#c8963e', background: null }) as Record<string, string>
    expect(style['--secondary']).toBe('#c8963e')
    expect(style['--primary']).toBeUndefined()
    expect(style['--background']).toBeUndefined()
  })
})
