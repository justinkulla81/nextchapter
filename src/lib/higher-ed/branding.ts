// Institution theming helpers. The accent color comes from the college, so
// text placed on it has to be picked for contrast rather than assumed white.

// White or near-black, whichever reads better on `hex` (WCAG relative
// luminance; falls back to white for anything unparseable).
export function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  // Contrast against white vs. against #0a0a0a; pick the higher.
  const onWhite = 1.05 / (lum + 0.05)
  const onDark = (lum + 0.05) / 0.0533
  return onWhite >= onDark ? '#ffffff' : '#0a0a0a'
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|the|and|&)$/i.test(w))
  return (words.slice(0, 2).map((w) => w[0]).join('') || name.slice(0, 2)).toUpperCase()
}

// The accent as a text color on a white page: the accent itself when it reads (WCAG AA, 4.5:1), else the accent darkened until it does.
// A light accent such as a sky blue is fine for a button with dark text on it, but not for link text on white.
export function accentTextOnWhite(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#14213d'
  const n = parseInt(m[1], 16)
  let rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const lum = (c: number[]) => {
    const ch = (v: number) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
  }
  for (let i = 0; i < 40 && 1.05 / (lum(rgb) + 0.05) < 4.5; i++) rgb = rgb.map((v) => Math.round(v * 0.92))
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
