import { hexToRgb, hslToRgb, hueDistance, inkOn, normalizeHex, readableOn, rgbDistance, rgbToHex, tint, toHsl, type Rgb } from './colors'

// Reads an organization's look from its own website: the two colors that carry its brand. Pure: it takes the page's HTML and its
// stylesheets as text, so the network fetch (fetch-site.ts) and the tests stay apart. The owner can override either color later.
//
// What it does, in order:
//   1. Collects every color the site declares (hex, rgb, hsl), weighted by where it is used (backgrounds count most) and by strong
//      hints (the theme-color meta tag, custom properties named brand/primary/accent).
//   2. Drops what is not a brand color: near-white, near-black, grays, and the default palettes frameworks ship (WordPress, Bootstrap).
//   3. Merges near-identical colors, ranks the rest, and picks the primary, then a secondary that is clearly different from it.

export interface ColorCandidate {
  hex: string
  weight: number
  /** Short plain-language reason, shown to the person reviewing the scan. */
  where: string
}

export interface BrandPair {
  primary: string
  secondary: string
  /** Text color that reads on each, white or near-black. */
  primaryInk: string
  secondaryInk: string
  /** The primary darkened until it reads as text on white (links, headings). */
  primaryText: string
  /** A pale tint of the primary for soft backgrounds. */
  primarySoft: string
  /** True when no second brand color was found and the secondary was derived from the primary. */
  secondaryDerived: boolean
}

export interface ScanResult {
  candidates: ColorCandidate[]
  pair: BrandPair | null
}

// Palettes that frameworks and themes ship by default. A site that only shows these has not told us its brand.
const FRAMEWORK_DEFAULTS = new Set([
  // WordPress core presets
  '#abb8c3', '#f78da7', '#cf2e2e', '#ff6900', '#fcb900', '#7bdcb5', '#00d084', '#8ed1fc', '#0693e3', '#9b51e0', '#007cba', '#006ba1', '#005a87', '#7a00df',
  // Bootstrap 4/5
  '#007bff', '#0d6efd', '#6c757d', '#198754', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#0dcaf0', '#6610f2', '#6f42c1', '#d63384', '#fd7e14', '#20c997',
  // Link blue and form defaults
  '#0000ee', '#0000ff', '#551a8b',
  // Social-network brand colors from share buttons and icons: they say who the site links to, not who it is.
  '#ea4335', '#4285f4', '#34a853', '#fbbc05', '#0077b5', '#0a66c2', '#2ca5e0', '#1da1f2', '#1877f2', '#3b5998', '#4267b2', '#ff0000', '#cd201f',
  '#e1306c', '#c13584', '#25d366', '#bd081c', '#e60023', '#ff4500', '#6441a5', '#00aced', '#dd4b39', '#1b1f23',
])

const MAX_CANDIDATES = 8

// ---- reading colors out of text ---------------------------------------------------------------------------------------------------

interface Raw {
  hex: string
  weight: number
  where: string
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n))
}

/** Parses one CSS color value (hex, rgb[a], hsl[a]); returns null for anything else, and for mostly transparent colors. */
export function parseCssColor(value: string): string | null {
  const v = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)
  if (hex) {
    const h = hex[1]
    if (h.length === 8) {
      const alpha = parseInt(h.slice(6), 16) / 255
      if (alpha < 0.5) return null
      return `#${h.slice(0, 6)}`
    }
    return normalizeHex(`#${h}`)
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]+)\)$/.exec(v)
  if (!fn) return null
  const parts = fn[2].split(/[\s,\/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const alphaRaw = parts[3]
  if (alphaRaw != null) {
    const a = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw)
    if (!Number.isNaN(a) && a < 0.5) return null
  }
  if (fn[1].startsWith('rgb')) {
    const nums = parts.slice(0, 3).map((p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)))
    if (nums.some((n) => Number.isNaN(n))) return null
    return rgbToHex(nums.map(clamp255) as Rgb)
  }
  const h = parseFloat(parts[0])
  const s = parseFloat(parts[1]) / (parts[1].endsWith('%') ? 100 : 1)
  const l = parseFloat(parts[2]) / (parts[2].endsWith('%') ? 100 : 1)
  if ([h, s, l].some((n) => Number.isNaN(n))) return null
  return rgbToHex(hslToRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))))
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/g
// property: value; pairs. The property decides the weight; the value is searched for color tokens.
const DECL = /([a-z-]+)\s*:\s*([^;{}]+)/gi
const HINT_NAME = /^--(?:[\w-]*?)(brand|primary|accent|theme|main|key|secondary|highlight)[\w-]*$/i
const NOISE_NAME = /^--(?:wp--preset|wp-admin|wp-block|bs-|tw-|mdc-|sqs-|ant-|chakra-)/i

function propertyWeight(prop: string): number {
  if (/^background/.test(prop)) return 3
  if (prop === 'fill' || prop === 'stroke') return 1
  if (prop === 'color') return 1
  if (/^border/.test(prop) || prop === 'outline-color') return 1
  return 1
}

function collect(text: string, source: string, out: Raw[]): void {
  DECL.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DECL.exec(text))) {
    const prop = m[1].toLowerCase()
    const value = m[2]
    const isVar = prop.startsWith('--')
    if (isVar && NOISE_NAME.test(prop)) continue
    const tokens = value.match(COLOR_TOKEN)
    if (!tokens) continue
    const hinted = isVar && HINT_NAME.test(prop)
    for (const t of tokens) {
      const hex = parseCssColor(t)
      if (!hex) continue
      if (hinted) out.push({ hex, weight: 30, where: `named as a brand color in ${source}` })
      else if (!isVar) out.push({ hex, weight: propertyWeight(prop), where: /^background/.test(prop) ? `backgrounds in ${source}` : `text and borders in ${source}` })
    }
  }
}

/** The theme-color and tile-color meta tags: the site's own statement of its color. */
function metaColors(html: string): string[] {
  const out: string[] = []
  const re = /<meta\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const tag = m[0]
    if (!/name\s*=\s*["'](?:theme-color|msapplication-tilecolor)["']/i.test(tag)) continue
    const c = /content\s*=\s*["']([^"']+)["']/i.exec(tag)
    const hex = c ? parseCssColor(c[1]) : null
    if (hex) out.push(hex)
  }
  return out
}

// ---- ranking ---------------------------------------------------------------------------------------------------------------------

function isBrandLike(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const { s, l } = toHsl(rgb)
  if (l > 0.9 || l < 0.06) return false
  if (s < 0.12) return false
  // Dark near-neutrals (a charcoal or a dark gray-green for body text) are not a brand color; a deep green or brown with real color is.
  if (l < 0.15 && s < 0.3) return false
  return !FRAMEWORK_DEFAULTS.has(hex)
}

function merge(raws: Raw[]): ColorCandidate[] {
  const kept = raws.filter((r) => isBrandLike(r.hex))
  const clusters: { rgb: Rgb; weight: number; hex: string; best: Raw; bestWeight: number }[] = []
  for (const r of kept) {
    const rgb = hexToRgb(r.hex)!
    const near = clusters.find((c) => rgbDistance(c.rgb, rgb) < 24)
    if (near) {
      near.weight += r.weight
      if (r.weight > near.bestWeight) {
        near.best = r
        near.bestWeight = r.weight
      }
      continue
    }
    clusters.push({ rgb, weight: r.weight, hex: r.hex, best: r, bestWeight: r.weight })
  }
  // The most-seen spelling of a color leads its cluster; saturated colors outrank washed-out ones of the same weight.
  return clusters
    .map((c) => {
      const exact = new Map<string, number>()
      for (const r of kept) if (rgbDistance(hexToRgb(r.hex)!, c.rgb) < 24) exact.set(r.hex, (exact.get(r.hex) ?? 0) + r.weight)
      const lead = [...exact.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const sat = toHsl(hexToRgb(lead)!).s
      return { hex: lead, weight: Math.round(c.weight * (0.6 + sat * 0.8)), where: c.best.where }
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CANDIDATES)
}

/** Whether two colors are different enough to be a primary and a secondary: a different hue, or clearly lighter or darker. */
function distinct(a: string, b: string): boolean {
  const x = toHsl(hexToRgb(a)!)
  const y = toHsl(hexToRgb(b)!)
  return hueDistance(x.h, y.h) >= 25 || Math.abs(x.l - y.l) >= 0.3
}

/** The full pair (ink, text and soft colors included) for two chosen colors. Used by the scan and when a stored or hand-set pair is read back. */
export function buildPair(primary: string, secondary: string, secondaryDerived = false): BrandPair {
  return {
    primary,
    secondary,
    primaryInk: inkOn(primary),
    secondaryInk: inkOn(secondary),
    primaryText: readableOn(primary),
    primarySoft: tint(primary),
    secondaryDerived,
  }
}

export function pickPair(candidates: ColorCandidate[]): BrandPair | null {
  if (candidates.length === 0) return null
  const primary = candidates[0].hex
  const others = candidates.slice(1).filter((c) => distinct(primary, c.hex))
  // A real accent beats a very dark ink color (body-text navy or charcoal) when the site has both.
  const accent = (c: ColorCandidate) => {
    const h = toHsl(hexToRgb(c.hex)!)
    // Not a pale tint either: those are page backgrounds.
    return h.l >= 0.2 && h.l <= 0.75 && h.s >= 0.25
  }
  const second = others.find(accent) ?? others[0]
  const p = toHsl(hexToRgb(primary)!)
  // No second brand color on the site: a soft tint of the primary (or a deeper shade of a light one) stands in, so every page still has two colors.
  const secondary = second ? second.hex : p.l < 0.55 ? tint(primary, 0.55) : rgbToHex(hslToRgb(p.h, Math.min(1, p.s), Math.max(0.2, p.l - 0.3)))
  return buildPair(primary, secondary, !second)
}

/**
 * Scan a site. `html` is the home page; `stylesheets` are its CSS files, each with a short label for the "where" note.
 * An empty candidate list means the site did not tell us its colors (script-drawn pages, image-only headers).
 */
export function scanBrand(html: string, stylesheets: { label: string; css: string }[] = [], hints: { hex: string; weight: number; where: string }[] = []): ScanResult {
  const raws: Raw[] = []
  // Colors taken from the site's own icon: the most direct statement of the brand, weighted above any stylesheet.
  for (const h of hints) raws.push({ hex: h.hex, weight: h.weight, where: h.where })
  for (const hex of metaColors(html)) raws.push({ hex, weight: 40, where: 'the site’s theme color' })
  // Inline style attributes and <style> blocks in the page itself.
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1])
  for (const block of styleBlocks) collect(block, 'the page', raws)
  for (const attr of html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)) collect(attr[1], 'the page', raws)
  for (const s of stylesheets) collect(s.css, s.label, raws)
  const candidates = merge(raws)
  return { candidates, pair: pickPair(candidates) }
}

/**
 * For a site that draws its look with script, or refuses a plain request: the colors a real browser computed for the rendered page, each
 * with how much of the page it covers (scripts/branding/scan-orgs.ts collects them). Same filters and ranking as the text scan.
 */
export function scanComputedColors(entries: { color: string; weight: number }[], themeColor?: string | null): ScanResult {
  const raws: Raw[] = []
  const theme = themeColor ? parseCssColor(themeColor) : null
  if (theme) raws.push({ hex: theme, weight: 40, where: 'the site’s theme color' })
  for (const e of entries) {
    const hex = parseCssColor(e.color)
    if (hex) raws.push({ hex, weight: e.weight, where: 'colors on the rendered page' })
  }
  const candidates = merge(raws)
  return { candidates, pair: pickPair(candidates) }
}

// ---- how sure we are ------------------------------------------------------------------------------------------------------------------

/** A color is a strong read when the site said it (theme color, a brand-named property) or showed it (its own icon), not merely used it a lot. */
export function isStrongSource(where: string | undefined): boolean {
  return !!where && /own icon|theme color|named as a brand color/.test(where)
}

/**
 * The pair to use for a company page, where a wrong color is worse than none: only when the primary is a strong read. A secondary that is
 * only a frequent stylesheet color is replaced by a soft tint of the primary. Null means "leave the page in NextChapter's look".
 */
export function confidentPair(result: ScanResult): BrandPair | null {
  const pair = result.pair
  if (!pair) return null
  const where = (hex: string) => result.candidates.find((c) => c.hex === hex)?.where
  if (!isStrongSource(where(pair.primary))) return null
  if (pair.secondaryDerived || isStrongSource(where(pair.secondary))) return pair
  return buildPair(pair.primary, tint(pair.primary, 0.55), true)
}
