import { describe, expect, it } from 'vitest'
import { contrast, hexToRgb, hueDistance, inkOn, normalizeHex, readableOn, rgbToHex, tint } from '@/lib/branding/colors'
import { parseCssColor, pickPair, scanBrand } from '@/lib/branding/scan'

describe('color math', () => {
  it('reads and writes hex', () => {
    expect(hexToRgb('#0e553f')).toEqual([14, 85, 63])
    expect(hexToRgb('abc')).toEqual([170, 187, 204])
    expect(rgbToHex([14, 85, 63])).toBe('#0e553f')
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef')
    expect(normalizeHex('nope')).toBeNull()
  })
  it('measures contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })
  it('picks white or near-black text', () => {
    expect(inkOn('#0e553f')).toBe('#ffffff')
    expect(inkOn('#ffc627')).toBe('#111111')
    // A light blue cannot carry white text; the scan switches to dark.
    expect(inkOn('#4bb0c8')).toBe('#111111')
  })
  it('darkens a color until it reads as text on white and keeps the hue', () => {
    const out = readableOn('#4bb0c8')
    expect(contrast(out, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    const a = hexToRgb('#4bb0c8')!
    const b = hexToRgb(out)!
    // Same proportions, so the hue is the same.
    expect(Math.abs(b[2] / b[0] - a[2] / a[0])).toBeLessThan(0.15)
    // Already readable: unchanged.
    expect(readableOn('#0e553f')).toBe('#0e553f')
  })
  it('measures hue distance around the wheel', () => {
    expect(hueDistance(350, 10)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
  })
  it('makes a pale tint', () => {
    expect(contrast(tint('#0e553f'), '#111111')).toBeGreaterThan(12)
  })
})

describe('parseCssColor', () => {
  it('reads hex, rgb and hsl', () => {
    expect(parseCssColor('#FFC627')).toBe('#ffc627')
    expect(parseCssColor('#fc0')).toBe('#ffcc00')
    expect(parseCssColor('rgb(56, 38, 28)')).toBe('#38261c')
    expect(parseCssColor('rgba(56,38,28,0.9)')).toBe('#38261c')
    expect(parseCssColor('hsl(0, 100%, 50%)')).toBe('#ff0000')
    expect(parseCssColor('hsla(210, 50%, 40%, 1)')).toBe('#336699')
  })
  it('ignores mostly transparent colors and non-colors', () => {
    expect(parseCssColor('rgba(0,0,0,0.12)')).toBeNull()
    expect(parseCssColor('#11223344')).toBeNull()
    expect(parseCssColor('transparent')).toBeNull()
    expect(parseCssColor('var(--x)')).toBeNull()
  })
})

// Shaped like the styles of three real sites we looked at: a university (many greens, one gold), a city site (blue-teal and orange behind
// a WordPress preset list), and a firm whose page is mostly neutral with one dark brown.
const UNIVERSITY_CSS = `
.hero{background:#0e553f}.nav{background:#0e553f}.footer{background:#003221}
.btn{background-color:#ffc627;color:#151e16}.a{color:#2f8f8d}
.card{background:#f1f0ea;border:1px solid #d0cab9}.x{color:#212529}
.h1{background:#0e553f}.h2{background:#0e553f}.dark{background:#003221}.gold{background:#ffc627}
`

describe('scanBrand', () => {
  it('finds a university’s green and gold', () => {
    const r = scanBrand('<html></html>', [{ label: 'its stylesheet', css: UNIVERSITY_CSS }])
    expect(r.pair?.primary).toBe('#0e553f')
    expect(r.pair?.secondary).toBe('#ffc627')
    expect(r.pair?.secondaryDerived).toBe(false)
    expect(r.pair?.primaryInk).toBe('#ffffff')
    expect(r.pair?.secondaryInk).toBe('#111111')
    // Neutrals never become brand colors.
    expect(r.candidates.map((c) => c.hex)).not.toContain('#f1f0ea')
    expect(r.candidates.map((c) => c.hex)).not.toContain('#212529')
  })

  it('treats the theme-color tag as the strongest hint and ignores WordPress presets', () => {
    const html = `<meta name="theme-color" content="#58c9ed"><style>
      :root{--wp--preset--color--vivid-red:#cf2e2e;--wp--preset--color--vivid-cyan-blue:#0693e3}
      .a{background:#4bb0c8}.b{background:#4bb0c8}.c{background:#f9b24e}.d{color:#cf2e2e}</style>`
    const r = scanBrand(html)
    expect(r.candidates.map((c) => c.hex)).not.toContain('#cf2e2e')
    expect(r.candidates.map((c) => c.hex)).not.toContain('#0693e3')
    expect(['#58c9ed', '#4bb0c8']).toContain(r.pair?.primary)
    expect(r.pair?.secondary).toBe('#f9b24e')
    // White text on this blue would fail; the pair carries dark text instead, and the text color still reads on white.
    expect(r.pair?.primaryInk).toBe('#111111')
    expect(contrast(r.pair!.primaryText, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('reads colors written as hsla and rgb, and a brand-named custom property', () => {
    const html = `<style>:root{--brand-color:hsla(20,34%,17%,1)}.n{background:rgb(240,238,228)}.s{background:rgb(143,140,120)}.t{background:rgb(43,59,59)}</style>`
    const r = scanBrand(html)
    expect(r.pair?.primary).toBe('#3a261d')
    expect(r.candidates.length).toBeGreaterThan(0)
  })

  it('returns no pair when the site shows no brand colors', () => {
    const r = scanBrand('<body style="color:#333;background:#fff"></body>', [{ label: 'x', css: '.a{color:#777}.b{background:#eee}' }])
    expect(r.candidates).toEqual([])
    expect(r.pair).toBeNull()
  })

  it('derives a second color when the site has only one', () => {
    const r = scanBrand('', [{ label: 'x', css: '.a{background:#0e553f}.b{background:#0f5640}.c{color:#0e553f}' }])
    expect(r.pair?.primary).toBe('#0e553f')
    expect(r.pair?.secondaryDerived).toBe(true)
    expect(r.pair?.secondary).not.toBe(r.pair?.primary)
  })

  it('prefers a real accent to a pale tint or a very dark ink color', () => {
    const pair = pickPair([
      { hex: '#1c355e', weight: 686, where: 'a' },
      { hex: '#d1e3ed', weight: 534, where: 'a' }, // pale blue: a background tint
      { hex: '#00c1de', weight: 384, where: 'a' },
    ])
    expect(pair?.secondary).toBe('#00c1de')
    const dark = pickPair([
      { hex: '#334aff', weight: 168, where: 'a' },
      { hex: '#141827', weight: 129, where: 'a' }, // near-black navy for text
      { hex: '#f4731c', weight: 21, where: 'a' },
    ])
    expect(dark?.secondary).toBe('#f4731c')
  })

  it('picks a secondary that is clearly different from the primary', () => {
    const pair = pickPair([
      { hex: '#0e553f', weight: 100, where: 'a' },
      { hex: '#003221', weight: 80, where: 'a' }, // same hue, only a little darker: not distinct
      { hex: '#2f8f8d', weight: 70, where: 'a' }, // hue within 25 degrees: not distinct
      { hex: '#ffc627', weight: 20, where: 'a' },
    ])
    expect(pair?.secondary).toBe('#ffc627')
  })
})

describe('org theme', () => {
  it('turns a pair into the page variables', async () => {
    const { orgThemeVars, ctaColors } = await import('@/lib/branding/theme')
    const { buildPair } = await import('@/lib/branding/scan')
    const pair = buildPair('#602d91', '#ccb9d8')
    const vars = orgThemeVars(pair)!
    expect(vars['--org-1']).toBe('#602d91')
    expect(vars['--org-1-ink']).toBe('#ffffff')
    expect(vars['--org-2-ink']).toBe('#111111')
    expect(orgThemeVars(null)).toBeUndefined()
    // The button stands out from the band it sits on.
    expect(contrast(ctaColors(pair).bg, pair.primary)).toBeGreaterThanOrEqual(3)
  })
  it('falls back to a white button when the secondary does not stand out from the primary', async () => {
    const { ctaColors } = await import('@/lib/branding/theme')
    const { buildPair } = await import('@/lib/branding/scan')
    const pair = buildPair('#0e553f', '#0f5a43')
    expect(ctaColors(pair)).toEqual({ bg: '#ffffff', ink: '#111111' })
  })
})
