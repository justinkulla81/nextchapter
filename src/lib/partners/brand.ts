import type { CSSProperties } from 'react'
import { initials, readableTextOn } from '@/lib/higher-ed/branding'

// One brand shape for every partner portal (higher ed, outplacement, coach,
// hiring team, recruiter). Each portal stores its brand differently today; this
// is the single thing the shared shell reads, whatever the source.

export interface PartnerBrand {
  /** The partner's name as shown in the top bar, e.g. "Riverside College". */
  name: string | null
  logoUrl: string | null
  /** Primary color, hex #rrggbb: buttons, links, focus. Null keeps NextChapter's own. */
  accent: string | null
  /** Secondary color, hex #rrggbb: secondary buttons, chips, highlights. */
  secondary?: string | null
  /** Page background, hex #rrggbb. Text and surfaces are derived from it so they stay readable. */
  background?: string | null
}

export const NO_BRAND: PartnerBrand = { name: null, logoUrl: null, accent: null, secondary: null, background: null }

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
  return {
    name: pick('name', text),
    logoUrl: pick('logoUrl', url),
    accent: pick('accent', normalizeHex),
    secondary: pick('secondary', normalizeHex),
    background: pick('background', normalizeHex),
  }
}

/** Blend `a` toward `b` by `amount` (0 to 1). Both #rrggbb. */
export function mixColors(a: string, b: string, amount: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const mixed = [16, 8, 0].map((shift) => {
    const ca = (x >> shift) & 255
    const cb = (y >> shift) & 255
    return Math.round(ca + (cb - ca) * amount)
  })
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The page tokens that follow from a chosen background: readable text, a card
 * that sits just off the page, and muted and border tones blended from the two.
 * Always readable, whatever color the partner picks.
 */
export function backgroundTokens(background: string): Record<string, string> {
  const foreground = readableTextOn(background)
  const light = foreground === '#0a0a0a'
  return {
    '--background': background,
    '--foreground': foreground,
    '--card': light ? mixColors(background, '#ffffff', 0.6) : mixColors(background, '#ffffff', 0.08),
    '--card-foreground': foreground,
    '--muted': mixColors(background, foreground, 0.08),
    '--muted-foreground': mixColors(background, foreground, 0.68),
    '--border': mixColors(background, foreground, 0.16),
    '--input': mixColors(background, foreground, 0.2),
  }
}

/**
 * CSS variables for the portal root. With no colors the portal keeps the
 * default look. The primary takes buttons, focus rings and the brand rule; the
 * secondary takes secondary buttons and chips; the background retones the page.
 * Text on each is picked for contrast.
 */
export function brandStyle(brand: PartnerBrand | null | undefined): CSSProperties | undefined {
  if (!brand) return undefined
  const vars: Record<string, string> = {}
  if (brand.accent) {
    vars['--primary'] = brand.accent
    vars['--primary-foreground'] = readableTextOn(brand.accent)
    vars['--ring'] = brand.accent
    vars['--partner-brand'] = brand.accent
  }
  if (brand.secondary) {
    vars['--secondary'] = brand.secondary
    vars['--secondary-foreground'] = readableTextOn(brand.secondary)
    vars['--accent'] = brand.secondary
    vars['--accent-foreground'] = readableTextOn(brand.secondary)
    vars['--partner-secondary'] = brand.secondary
  }
  if (brand.background) Object.assign(vars, backgroundTokens(brand.background))
  return Object.keys(vars).length ? (vars as CSSProperties) : undefined
}

/** Black or white text, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  return readableTextOn(hex)
}

export function brandInitials(brand: PartnerBrand | null | undefined, fallback = 'P'): string {
  return brand?.name ? initials(brand.name) : fallback
}
