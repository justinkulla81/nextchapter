// A search firm's brand color, read from its own website: the page's theme-color, its web manifest, or the dominant
// color of its icon. Pure parsing and color rules are here (brand-color.test.ts); the fetching is in brand-color-fetch.ts.
// The color is used only as the accent on the firm's page (its "Express interest" button), so it must read as a button
// on a white page: dark enough for white text, never pure black, white or grey.

export type BrandColorSource = 'theme-color' | 'manifest' | 'icon' | 'logo' | 'none'

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

/** "#abc", "#aabbcc", "rgb(1,2,3)" or "rgba(...)" as "#aabbcc"; null for anything else (names, hsl, var()). */
export function normalizeColor(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s)
  if (m) return `#${m[1]}`
  m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(s)
  if (m) return `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`
  return null
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/** White text on this color needs a contrast ratio of at least 4.5, i.e. a luminance of at most about 0.18. */
const MAX_LUMINANCE = 0.18

/**
 * A color a page can use as a button accent, or null. Greys, black and white are defaults (a dark-mode theme-color, a
 * placeholder), not a brand, so they are rejected. A saturated color that is too light is darkened toward black until
 * white text reads on it, which keeps its hue.
 */
export function usableAccent(raw: string | null | undefined): string | null {
  const hex = normalizeColor(raw)
  if (!hex) return null
  if (saturation(hex) < 0.18) return null
  // Near-black is a dark theme, not a brand (a saturation test alone passes #030507).
  if (luminance(hex) < 0.003) return null
  let [r, g, b] = rgb(hex)
  for (let i = 0; i < 30 && luminance(`#${hex2(r)}${hex2(g)}${hex2(b)}`) > MAX_LUMINANCE; i++) { r *= 0.9; g *= 0.9; b *= 0.9 }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : null
}

export interface PageHints { themeColor: string | null; tileColor: string | null; manifestUrl: string | null; iconUrl: string | null }

/** What a firm's homepage says about its color and where its icon and manifest are. Dark-mode theme-colors are skipped. */
export function pageHints(html: string, base: string): PageHints {
  const head = html.slice(0, 200_000)
  const abs = (u: string | null) => { if (!u) return null; try { return new URL(u, base).toString() } catch { return null } }
  let themeColor: string | null = null
  let tileColor: string | null = null
  let manifest: string | null = null
  const icons: { href: string; size: number; rank: number }[] = []
  for (const tag of head.match(/<(?:meta|link)\b[^>]*>/gi) ?? []) {
    const isMeta = /^<meta/i.test(tag)
    if (isMeta) {
      const name = (attr(tag, 'name') ?? '').toLowerCase()
      if (name === 'theme-color' && !/dark/i.test(attr(tag, 'media') ?? '') && !themeColor) themeColor = attr(tag, 'content')
      if (name === 'msapplication-tilecolor' && !tileColor) tileColor = attr(tag, 'content')
      continue
    }
    const rel = (attr(tag, 'rel') ?? '').toLowerCase()
    const href = attr(tag, 'href')
    if (!href) continue
    if (rel.includes('manifest')) manifest = href
    else if (rel.includes('apple-touch-icon')) icons.push({ href, size: parseInt(attr(tag, 'sizes') ?? '0', 10) || 0, rank: 2 })
    else if (rel.includes('icon') && !/\.ico(\?|$)/i.test(href)) icons.push({ href, size: parseInt(attr(tag, 'sizes') ?? '0', 10) || 0, rank: 1 })
  }
  icons.sort((a, b) => b.rank - a.rank || b.size - a.size)
  return { themeColor, tileColor, manifestUrl: abs(manifest), iconUrl: abs(icons[0]?.href ?? null) }
}

/** The most common saturated color in a set of RGBA pixels (a 4-bit-per-channel histogram), ignoring white, grey and transparent. */
export function dominantColor(pixels: Uint8Array | Buffer, channels = 4): string | null {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + channels <= pixels.length; i += channels) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    const a = channels === 4 ? pixels[i + 3] : 255
    if (a < 200) continue
    const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}`
    if (saturation(hex) < 0.25) continue
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += r; e.g += g; e.b += b
    counts.set(key, e)
  }
  let best: { n: number; r: number; g: number; b: number } | null = null
  for (const e of counts.values()) if (!best || e.n > best.n) best = e
  return best ? `#${hex2(best.r / best.n)}${hex2(best.g / best.n)}${hex2(best.b / best.n)}` : null
}

/** The same exact color on three or more unrelated firms is a hosting template's default, not a brand: those are dropped. */
export function dropSharedDefaults<T extends { color: string | null }>(rows: T[], minShared = 3): T[] {
  const n = new Map<string, number>()
  for (const r of rows) if (r.color) n.set(r.color, (n.get(r.color) ?? 0) + 1)
  return rows.map((r) => (r.color && (n.get(r.color) ?? 0) >= minShared ? { ...r, color: null } : r))
}
