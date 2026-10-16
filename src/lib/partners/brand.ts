import type { CSSProperties } from 'react'
import { initials, readableTextOn } from '@/lib/higher-ed/branding'

// One brand shape for every partner portal (higher ed, outplacement, coach,
// hiring team, recruiter). Each portal stores its brand differently today; this
// is the single thing the shared shell reads, whatever the source.

export interface PartnerBrand {
  /** The partner's name as shown in the top bar, e.g. "Riverside College". */
  name: string | null
  logoUrl: string | null
  /** Hex, #rrggbb. Null means the portal keeps NextChapter's own accent. */
  accent: string | null
}

export const NO_BRAND: PartnerBrand = { name: null, logoUrl: null, accent: null }

const HEX = /^#[0-9a-f]{6}$/i

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const withHash = v.startsWith('#') ? v : `#${v}`
  return HEX.test(withHash) ? withHash.toLowerCase() : null
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio between two #rrggbb colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * Whether a brand color is safe to use as the accent for links, buttons and
 * charts on a white page (WCAG AA for large text and UI parts is 3:1). Very
 * light colors fail; the portal can still use them for the top-bar rule.
 */
export function accentReadableOnWhite(hex: string): boolean {
  return contrastRatio(hex, '#ffffff') >= 3
}

/**
 * The partner's own brand wins; anything missing or invalid falls back to the
 * fields of the next source. Used when an Organization's brand overrides the
 * brand stored on a portal's own record.
 */
export function mergeBrand(...sources: Array<Partial<PartnerBrand> | null | undefined>): PartnerBrand {
  const pick = <K extends keyof PartnerBrand>(key: K, clean: (v: unknown) => PartnerBrand[K]): PartnerBrand[K] => {
    for (const s of sources) {
      const v = s ? clean(s[key]) : null
      if (v) return v
    }
    return null as PartnerBrand[K]
  }
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null)
  const url = (v: unknown) => (typeof v === 'string' && /^(https:\/\/|data:image\/)/.test(v.trim()) ? v.trim() : null)
  return { name: pick('name', text), logoUrl: pick('logoUrl', url), accent: pick('accent', normalizeHex) }
}

/**
 * CSS variables for the portal root. With no accent the portal keeps the
 * default look. With one, primary buttons, focus rings and the brand rule take
 * it, and text on it is picked for contrast.
 */
export function brandStyle(brand: PartnerBrand | null | undefined): CSSProperties | undefined {
  const accent = brand?.accent
  if (!accent) return undefined
  return {
    '--primary': accent,
    '--primary-foreground': readableTextOn(accent),
    '--ring': accent,
    '--partner-brand': accent,
  } as CSSProperties
}

export function brandInitials(brand: PartnerBrand | null | undefined, fallback = 'P'): string {
  return brand?.name ? initials(brand.name) : fallback
}
