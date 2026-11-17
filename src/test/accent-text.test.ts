import { describe, expect, it } from 'vitest'
import { accentTextOnWhite } from '@/lib/higher-ed/branding'

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

describe('accentTextOnWhite', () => {
  it('darkens a light accent until it reads on white (4.5:1)', () => {
    const out = accentTextOnWhite('#77C6E9')
    expect(1.05 / (lum(out) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
  it('keeps a dark accent as it is', () => {
    expect(accentTextOnWhite('#133968').toLowerCase()).toBe('#133968')
  })
  it('falls back for something that is not a color', () => {
    expect(accentTextOnWhite('blue')).toBe('#14213d')
  })
})
