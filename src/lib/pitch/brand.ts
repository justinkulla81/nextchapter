import sharp from 'sharp'
import type { Brand } from './types'

// Colors for a deck: NextChapter's own, or the prospect's. Prospect colors come
// from hex pickers or are read off their logo. Whatever is chosen is darkened
// until white text on it passes WCAG AA, because the deck puts white text on the
// primary (cover, table headers) and primary-colored numbers on white.

export const NEXTCHAPTER_COLORS = { primary: '#2e7d5b', accent: '#0b2545' }
export type ColorMode = 'nextchapter' | 'custom' | 'logo'

const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
const toHex = ([r, g, b]: number[]) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** Contrast ratio of a color against white. */
export const contrastWithWhite = (hex: string) => 1.05 / (lum(toRgb(hex)) + 0.05)

/** Darken until white text passes AA (4.5:1). */
export function ensureReadable(hex: string): string {
  if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return NEXTCHAPTER_COLORS.primary
  let rgb: number[] = toRgb(hex)
  for (let i = 0; i < 30 && contrastWithWhite(toHex(rgb)) < 4.5; i++) rgb = rgb.map((c) => c * 0.92)
  return toHex(rgb)
}

/** Dominant brand colors from a logo: ignores transparent, near-white and gray pixels. */
export async function extractColors(img: Buffer): Promise<{ primary: string; accent: string } | null> {
  try {
    const { data, info } = await sharp(img).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const buckets = new Map<string, { n: number; rgb: number[] }>()
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 200) continue
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max > 235 && min > 225) continue // white
      if (max - min < 28) continue // gray / black
      const key = [r, g, b].map((c) => Math.round(c / 40)).join(',')
      const e = buckets.get(key) ?? { n: 0, rgb: [0, 0, 0] }
      e.n++; e.rgb = e.rgb.map((c, k) => c + [r, g, b][k]); buckets.set(key, e)
    }
    const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => e.rgb.map((c) => c / e.n))
    if (!ranked.length) return null
    const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    const second = ranked.find((c) => dist(c, ranked[0]) > 90) ?? null
    return { primary: toHex(ranked[0]), accent: second ? toHex(second) : NEXTCHAPTER_COLORS.accent }
  } catch {
    return null
  }
}

export async function resolveBrand(i: { mode: ColorMode; orgName: string; logo?: string; primary?: string; accent?: string }): Promise<{ brand: Brand; note?: string }> {
  let primary = NEXTCHAPTER_COLORS.primary, accent = NEXTCHAPTER_COLORS.accent
  let note: string | undefined
  if (i.mode === 'custom') {
    if (i.primary) primary = i.primary
    if (i.accent) accent = i.accent
  } else if (i.mode === 'logo') {
    const m = i.logo?.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i)
    const got = m ? await extractColors(Buffer.from(m[1], 'base64')) : null
    if (got) { primary = got.primary; accent = got.accent } else note = 'Could not read colors from the logo, so NextChapter colors were used.'
  }
  const readable = ensureReadable(primary)
  if (readable.toLowerCase() !== primary.toLowerCase()) note = `${note ? note + ' ' : ''}The main color was darkened a little so white text stays readable.`
  return { brand: { orgName: i.orgName, logo: i.logo, primary: readable, accent: ensureReadable(accent) }, note }
}
