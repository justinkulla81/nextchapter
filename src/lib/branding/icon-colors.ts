import 'server-only'
import sharp from 'sharp'
import { hexToRgb, rgbToHex, toHsl, type Rgb } from './colors'

// The dominant brand colors of a site's own icon (apple-touch-icon, favicon, logo image). A logo is the most direct statement of a brand's
// colors, so the scan weights these above anything read from the stylesheets. Decoded with sharp (PNG, JPEG, WebP, SVG; not .ico).

export interface IconColor { hex: string; share: number }

/** Up to `max` colors that carry the icon: grouped in coarse bins, near-white, near-black and gray dropped, most common first. */
export async function iconColors(image: Buffer, max = 2): Promise<IconColor[]> {
  const { data, info } = await sharp(image, { density: 144 })
    .resize(48, 48, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  let counted = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3]
    if (a < 200) continue
    counted++
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const { s, l } = toHsl([r, g, b])
    if (l > 0.9 || l < 0.08 || s < 0.25) continue
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n++; bin.r += r; bin.g += g; bin.b += b
    bins.set(key, bin)
  }
  if (counted === 0) return []
  const sorted = [...bins.values()].sort((x, y) => y.n - x.n)
  const out: IconColor[] = []
  for (const bin of sorted) {
    const rgb: Rgb = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n]
    // Merge a bin into an earlier, similar color instead of listing both.
    if (out.some((c) => { const o = hexToRgb(c.hex)!; return Math.hypot(o[0] - rgb[0], o[1] - rgb[1], o[2] - rgb[2]) < 60 })) continue
    out.push({ hex: rgbToHex(rgb), share: bin.n / counted })
    if (out.length >= max) break
  }
  // A color that covers almost none of the icon is noise (an anti-aliasing edge), not a brand color.
  return out.filter((c) => c.share >= 0.04)
}
