// White-label theme for a firm's public pages. Pure: safe in client components and tests.

export const BRAND_FONTS = {
  editorial: { label: 'Editorial serif', stack: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif' },
  modern: { label: 'Modern sans', stack: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif' },
  classic: { label: 'Classic serif', stack: 'Georgia,"Times New Roman",Times,serif' },
} as const
export type BrandFont = keyof typeof BRAND_FONTS

export const BRAND_TONES = {
  cream: { label: 'Cream', bg: '#f0eee4', paper: '#f7f6ef', line: '#d9d4c3' },
  white: { label: 'White', bg: '#ffffff', paper: '#f6f7f9', line: '#dfe3ea' },
} as const
export type BrandTone = keyof typeof BRAND_TONES

export const DEFAULT_ACCENT = '#1d4e89'

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v)
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** Text color that stays readable on the given background (WCAG-style contrast). */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#14233b' : '#ffffff'
}

export interface FirmBrandInput {
  accentColor?: string | null
  brandFont?: string | null
  brandTone?: string | null
}

export function firmTheme(firm: FirmBrandInput) {
  const accent = firm.accentColor && isHexColor(firm.accentColor) ? firm.accentColor : DEFAULT_ACCENT
  const font = (firm.brandFont && firm.brandFont in BRAND_FONTS ? firm.brandFont : 'editorial') as BrandFont
  const tone = (firm.brandTone && firm.brandTone in BRAND_TONES ? firm.brandTone : 'cream') as BrandTone
  return {
    accent,
    onAccent: readableOn(accent),
    fontStack: BRAND_FONTS[font].stack,
    font,
    tone,
    ...BRAND_TONES[tone],
    ink: '#38261c',
    muted: '#6b5b50',
  }
}

/** Website button HTML a firm pastes into any site builder. */
export function websiteButtonHtml(href: string, accent: string, label = 'Submit your resume'): string {
  const on = readableOn(accent)
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${accent};color:${on};text-decoration:none;text-transform:uppercase;letter-spacing:.1em;font-size:13px;font-family:inherit">${label}</a>`
}

/** Normalises what people type into a website field ("example.com" becomes https://example.com). */
export function normalizeWebsite(raw: string): { ok: true; url: string | null } | { ok: false; message: string } {
  const t = raw.trim()
  if (!t) return { ok: true, url: null }
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes('.')) throw new Error('no tld')
    return { ok: true, url: `${u.protocol}//${u.hostname}${u.pathname === '/' ? '' : u.pathname}` }
  } catch {
    return { ok: false, message: 'Enter your website like example.com.' }
  }
}
