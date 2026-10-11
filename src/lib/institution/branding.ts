// A college's look, kept in plain fields on Institution (logoUrl, accentColor,
// programBrandName) and the free-form `profile` JSON (heroImageUrl, tagline). Pure — the
// parsing rules are tested in src/test/institution-branding.test.ts.

export interface InstitutionBranding {
  accentColor: string | null
  logoUrl: string | null
  heroImageUrl: string | null
  tagline: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function cleanAccentColor(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  return v && HEX.test(v) ? v.toUpperCase() : null
}

/** Only https links to an image or an asset in our own storage are kept. */
export function cleanImageUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function cleanSlug(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '-')
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v) ? v : null
}

export function readBranding(inst: {
  accentColor: string | null
  logoUrl: string | null
  profile: unknown
}): InstitutionBranding {
  const p = (inst.profile && typeof inst.profile === 'object' ? inst.profile : {}) as Record<string, unknown>
  return {
    accentColor: cleanAccentColor(inst.accentColor),
    logoUrl: cleanImageUrl(inst.logoUrl),
    heroImageUrl: cleanImageUrl(typeof p.heroImageUrl === 'string' ? p.heroImageUrl : null),
    tagline: typeof p.tagline === 'string' && p.tagline.trim() ? p.tagline.trim().slice(0, 160) : null,
  }
}
