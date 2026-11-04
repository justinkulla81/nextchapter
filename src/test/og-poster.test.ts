import { describe, expect, it } from 'vitest'
import { PALETTES, pickLayout, pickPalette } from '@/lib/seo/og-poster'

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('share card palettes', () => {
  it('keeps text readable in every palette: body text AA, the large accent number at least 3 to 1', () => {
    for (const p of PALETTES) {
      expect(contrast(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(3)
      // the pill puts the background color on the accent
      expect(contrast(p.bg, p.accent)).toBeGreaterThanOrEqual(3)
    }
  })
  it('gives the same page the same card, and different pages different cards', () => {
    expect(pickPalette('bmw-brilliance')).toEqual(pickPalette('bmw-brilliance'))
    const slugs = Array.from({ length: 60 }, (_, i) => `employer-${i}`)
    expect(new Set(slugs.map((s) => pickPalette(s).bg)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(slugs.map((s) => pickLayout({ seed: s, people: 500 }))).size).toBeGreaterThanOrEqual(3)
  })
})

describe('share card layouts', () => {
  it('uses the dots only when there are people to count, and the bars only for a real ranking', () => {
    const seeds = Array.from({ length: 80 }, (_, i) => `s-${i}`)
    for (const s of seeds) {
      expect(['giant', 'split']).toContain(pickLayout({ seed: s }))
      expect(['giant', 'split']).toContain(pickLayout({ seed: s, people: 10 }))
      expect(['giant', 'split', 'dots']).toContain(pickLayout({ seed: s, people: 300 }))
      expect(['giant', 'split', 'bars']).toContain(pickLayout({ seed: s, bars: [1, 2, 3].map((n) => ({ label: `${n}`, valueLabel: `${n}`, frac: n / 3 })) }))
      expect(['giant', 'split']).toContain(pickLayout({ seed: s, bars: [{ label: 'a', valueLabel: '1', frac: 1 }] }))
    }
  })
})
