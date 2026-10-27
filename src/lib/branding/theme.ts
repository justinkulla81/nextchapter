import type { CSSProperties } from 'react'
import { contrast } from './colors'
import type { BrandPair } from './scan'

// The CSS custom properties an organization's colors become on a page. Pure, so server and client components and tests share it.
// --org-1 / --org-2   the primary and secondary colors
// --org-1-ink         readable text on the primary (white or near-black)
// --org-2-ink         readable text on the secondary
// --org-1-text        the primary darkened until it reads as text on white (headings, links)
// --org-1-soft        a pale tint of the primary for soft backgrounds
// --org-cta / --org-cta-ink   the button color on a primary-colored band: the secondary when it stands out from the primary, else white

export type OrgThemeVars = CSSProperties & Record<`--org-${string}`, string>

/** The button on a band painted in the primary color: the secondary when it stands out from the primary (3:1, the WCAG minimum for a control), else white. */
export function ctaColors(pair: BrandPair): { bg: string; ink: string } {
  return contrast(pair.secondary, pair.primary) >= 3 ? { bg: pair.secondary, ink: pair.secondaryInk } : { bg: '#ffffff', ink: '#111111' }
}

export function orgThemeVars(pair: BrandPair | null | undefined): OrgThemeVars | undefined {
  if (!pair) return undefined
  const cta = ctaColors(pair)
  return {
    '--org-1': pair.primary,
    '--org-2': pair.secondary,
    '--org-1-ink': pair.primaryInk,
    '--org-2-ink': pair.secondaryInk,
    '--org-1-text': pair.primaryText,
    '--org-1-soft': pair.primarySoft,
    '--org-cta': cta.bg,
    '--org-cta-ink': cta.ink,
  }
}
