import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { iconColors } from '@/lib/branding/icon-colors'
import { iconUrl } from '@/lib/branding/fetch-site'
import { buildPair, pickPair, scanBrand } from '@/lib/branding/scan'

async function png(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a] = paint(x, y); const i = (y * w + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

describe('iconColors', () => {
  it('finds the two colors of a two-color icon, most common first, ignoring a white background and a gray edge', async () => {
    const img = await png(64, 64, (x, y) => (x < 4 ? [128, 128, 128, 255] : y < 40 ? [0, 98, 66, 255] : x > 40 ? [255, 198, 39, 255] : [255, 255, 255, 255]))
    const out = await iconColors(img, 2)
    expect(out.length).toBe(2)
    expect(out[0].hex).toBe('#006242')
    expect(out[1].hex).toBe('#ffc627')
  })
  it('returns nothing for an all-white or fully transparent icon', async () => {
    expect(await iconColors(await png(32, 32, () => [255, 255, 255, 255]))).toEqual([])
    expect(await iconColors(await png(32, 32, () => [10, 20, 200, 0]))).toEqual([])
  })
})

describe('icon address', () => {
  it('prefers an Apple touch icon and skips .ico files', () => {
    const html = '<link rel="icon" href="/favicon.ico"><link rel="icon" sizes="32x32" href="/f32.png"><link rel="apple-touch-icon" sizes="180x180" href="/a.png">'
    expect(iconUrl(html, 'https://x.test')).toBe('https://x.test/a.png')
    expect(iconUrl('<link rel="icon" href="/favicon.ico">', 'https://x.test')).toBe('https://x.test/apple-touch-icon.png')
  })
})

describe('icon hints in the scan', () => {
  it('lets the icon outweigh the stylesheet blues', () => {
    const css = '.a{background:#0d76bd}.b{background:#0d76bd}.c{background:#0d76bd}.d{color:#16a0db}'
    const r = scanBrand('', [{ label: 's', css }], [{ hex: '#006242', weight: 60, where: 'the site’s own icon' }])
    expect(r.pair?.primary).toBe('#006242')
  })
  it('derives a soft second color, not a neon one', () => {
    const pair = pickPair([{ hex: '#006242', weight: 10, where: 'x' }])!
    expect(pair.secondaryDerived).toBe(true)
    expect(pair.secondary).not.toBe('#15ffb1')
    expect(buildPair(pair.primary, pair.secondary).secondaryInk).toBe('#111111')
  })
})

describe('confidentPair', () => {
  it('uses a pair whose primary comes from the icon or the theme color', async () => {
    const { confidentPair } = await import('@/lib/branding/scan')
    const r = scanBrand('<meta name="theme-color" content="#006242">', [{ label: 's', css: '.a{background:#cc0000}' }])
    const pair = confidentPair(r)
    expect(pair?.primary).toBe('#006242')
  })
  it('refuses a pair read only from how often a stylesheet uses a color', async () => {
    const { confidentPair } = await import('@/lib/branding/scan')
    const r = scanBrand('', [{ label: 's', css: '.a{background:#cc0000}.b{background:#cc0000}' }])
    expect(r.pair).not.toBeNull()
    expect(confidentPair(r)).toBeNull()
  })
  it('replaces a weak secondary with a soft tint of the primary', async () => {
    const { confidentPair } = await import('@/lib/branding/scan')
    const r = scanBrand('', [{ label: 's', css: '.a{background:#6e23c8}.b{background:#6e23c8}' }], [{ hex: '#cc0000', weight: 60, where: 'the site’s own icon' }])
    const pair = confidentPair(r)!
    expect(pair.primary).toBe('#cc0000')
    expect(pair.secondaryDerived).toBe(true)
    expect(pair.secondary).not.toBe('#6e23c8')
  })
})
