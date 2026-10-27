// Color math for organization branding. Pure (no database, no server-only), so the scanner, the page theme, the kit and the tests all
// read the same answers. Contrast follows WCAG 2.x relative luminance.

export type Rgb = [number, number, number]

const HEX6 = /^#?([0-9a-fA-F]{6})$/
const HEX3 = /^#?([0-9a-fA-F]{3})$/

export function hexToRgb(hex: string): Rgb | null {
  const s = hex.trim()
  const m6 = HEX6.exec(s)
  if (m6) {
    const n = parseInt(m6[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m3 = HEX3.exec(s)
  if (m3) {
    const [a, b, c] = m3[1].split('')
    return hexToRgb(`#${a}${a}${b}${b}${c}${c}`)
  }
  return null
}

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** A clean #rrggbb in lower case, or null when the text is not a color we can read. */
export function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null
  const rgb = hexToRgb(raw)
  return rgb ? rgbToHex(rgb) : null
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return 1
  const l1 = luminance(x)
  const l2 = luminance(y)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Hue 0-360, saturation and lightness 0-1. */
export function toHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h = Math.round(h * 60)
  if (h < 0) h += 360
  return { h, s, l }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const [r1, g1, b1] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]
}

/** Smallest angle between two hues, 0-180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/** White or near-black, whichever reads better on this background. */
export function inkOn(bg: string): '#ffffff' | '#111111' {
  return contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111'
}

/**
 * The same hue, darkened a step at a time until it reads as text on `against` (white by default) at `min` contrast.
 * The hue never changes. Stops after 30 steps, so a color that cannot get there comes back as dark as it can.
 */
export function readableOn(hex: string, against = '#ffffff', min = 4.5): string {
  let rgb = hexToRgb(hex)
  if (!rgb) return hex
  let n = 0
  while (contrast(rgbToHex(rgb), against) < min && n < 30) {
    rgb = rgb.map((v) => v * 0.94) as Rgb
    n++
  }
  return rgbToHex(rgb)
}

/** A lighter tint of the color (mix with white), for a soft background behind dark text. */
export function tint(hex: string, amount = 0.88): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(rgb.map((v) => v + (255 - v) * amount) as Rgb)
}
