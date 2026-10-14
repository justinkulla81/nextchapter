// The outplacement buyer's services menu: what the program offers, who
// delivers each service (NextChapter, or the company's own: its EAP, its
// benefits team, its internal job board), and packages (who gets what, e.g.
// "Executives" get coaching, everyone else doesn't). Client-safe; stored in
// OutplacementEmployerOrg.programSettings, a seat's package in
// OutplacementSeat.packageKey.
//
// A NextChapter service is never offered beyond what the contract tier
// includes. The company's own services don't depend on the tier.

import type { OutplacementTier } from '@prisma/client'

export type ProgramFeatureKey =
  | 'coaching'
  | 'resume'
  | 'dossier'
  | 'recruiters'
  | 'marketIntel'
  | 'interim'
  | 'alumniMembership'
  | 'benefits'
  | 'eap'
  | 'internalJobs'

const RANK: Record<OutplacementTier, number> = { CORE: 0, PLUS: 1, PREMIUM: 2 }

export type ProgramFeature = {
  key: ProgramFeatureKey
  label: string
  what: string
  // NextChapter's version: the tier that includes it and where it lives.
  // Null = only the company can provide it.
  nextchapter: { minTier: OutplacementTier; href: string } | null
  // The company can provide its own version.
  ownAllowed: boolean
}

export const PROGRAM_FEATURES: ProgramFeature[] = [
  { key: 'coaching', label: 'Coaching', what: 'One-to-one career coaching (Plus: 6 sessions, Premium: 12 and a named coach).', nextchapter: { minTier: 'PLUS', href: '/dashboard/coaching-match' }, ownAllowed: true },
  { key: 'resume', label: 'Resume Studio', what: 'Resume builder and ATS check; human reviews on Plus and Premium.', nextchapter: { minTier: 'CORE', href: '/dashboard/resume' }, ownAllowed: true },
  { key: 'dossier', label: 'Executive Dossier', what: 'A verified profile they can share with employers.', nextchapter: { minTier: 'CORE', href: '/dossier' }, ownAllowed: false },
  { key: 'recruiters', label: 'Recruiter network', what: 'Introductions to recruiters in their field.', nextchapter: { minTier: 'CORE', href: '/dashboard/recruiter-requests' }, ownAllowed: true },
  { key: 'marketIntel', label: 'Market Intelligence', what: 'Who is hiring, pay ranges and layoff signals for their target roles.', nextchapter: { minTier: 'CORE', href: '/dashboard/market-intelligence' }, ownAllowed: false },
  { key: 'interim', label: 'Interim and fractional work', what: 'Interim roles, board seats and fractional openings.', nextchapter: { minTier: 'CORE', href: '/dashboard/interim-work' }, ownAllowed: false },
  { key: 'alumniMembership', label: 'Free membership after they land', what: 'A year of NextChapter membership once they report a new job.', nextchapter: { minTier: 'PREMIUM', href: '/dashboard/membership' }, ownAllowed: false },
  { key: 'benefits', label: 'Severance and benefits questions', what: 'Your HR or benefits team for severance, COBRA and final pay.', nextchapter: null, ownAllowed: true },
  { key: 'eap', label: 'Counseling (EAP)', what: 'Your employee assistance program, if it continues after separation.', nextchapter: null, ownAllowed: true },
  { key: 'internalJobs', label: 'Internal openings and rehire', what: 'Open roles at your company they can apply to.', nextchapter: null, ownAllowed: true },
]

export type Provider = 'nextchapter' | 'own'
export type ServiceChoice = { on: boolean; provider: Provider; url: string | null; note: string | null }
export type ProgramPackage = { key: string; name: string; services: ProgramFeatureKey[] }
export type ProgramBrand = { logoUrl: string | null; accentColor: string | null }
export type ProgramSettings = {
  welcome: string | null
  /** The company's look on its people's dashboards. Kept in this JSON, so it needs no schema change. */
  brand: ProgramBrand
  services: Record<ProgramFeatureKey, ServiceChoice>
  packages: ProgramPackage[]
}

export const EVERYONE = 'all'

export function cleanBrandColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : null
}

function cleanBrandLogo(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\/\S+$/.test(value.trim()) ? value.trim() : null
}

export function tierIncludes(tier: OutplacementTier | null, key: ProgramFeatureKey): boolean {
  const f = PROGRAM_FEATURES.find((x) => x.key === key)
  return !!tier && !!f?.nextchapter && RANK[tier] >= RANK[f.nextchapter.minTier]
}

function defaultChoice(f: ProgramFeature): ServiceChoice {
  // NextChapter's services start on; the company's own start off until it adds a link or note.
  return { on: !!f.nextchapter, provider: f.nextchapter ? 'nextchapter' : 'own', url: null, note: null }
}

export function readProgramSettings(json: unknown): ProgramSettings {
  const o = (json ?? {}) as { features?: Record<string, unknown>; services?: Record<string, Partial<ServiceChoice>>; packages?: unknown; welcome?: unknown; brand?: { logoUrl?: unknown; accentColor?: unknown } }
  const services = Object.fromEntries(
    PROGRAM_FEATURES.map((f) => {
      const stored = o.services?.[f.key] ?? {}
      const legacyOff = o.features?.[f.key] === false
      const c: ServiceChoice = { ...defaultChoice(f), ...(legacyOff ? { on: false } : {}) }
      if (typeof stored.on === 'boolean') c.on = stored.on
      if (stored.provider === 'own' && f.ownAllowed) c.provider = 'own'
      if (stored.provider === 'nextchapter' && f.nextchapter) c.provider = 'nextchapter'
      if (typeof stored.url === 'string' && /^https:\/\/\S+$/.test(stored.url)) c.url = stored.url
      if (typeof stored.note === 'string' && stored.note.trim()) c.note = stored.note.trim().slice(0, 300)
      return [f.key, c]
    }),
  ) as Record<ProgramFeatureKey, ServiceChoice>
  const packages = Array.isArray(o.packages)
    ? (o.packages as ProgramPackage[])
        .filter((p) => p && typeof p.key === 'string' && typeof p.name === 'string' && p.key !== EVERYONE)
        .map((p) => ({ key: p.key, name: p.name.slice(0, 60), services: (p.services ?? []).filter((k) => PROGRAM_FEATURES.some((f) => f.key === k)) }))
        .slice(0, 10)
    : []
  const brand: ProgramBrand = { logoUrl: cleanBrandLogo(o.brand?.logoUrl), accentColor: cleanBrandColor(o.brand?.accentColor) }
  return { welcome: typeof o.welcome === 'string' && o.welcome.trim() ? o.welcome.trim().slice(0, 1000) : null, brand, services, packages }
}

export type OfferedService = ProgramFeature & { provider: Provider; href: string | null; note: string | null }

// What the program offers at all: switched on, and deliverable (NextChapter's
// within the tier; the company's own with a link or a note).
export function offeredFeatures(json: unknown, tier: OutplacementTier | null): OfferedService[] {
  const s = readProgramSettings(json)
  return PROGRAM_FEATURES.flatMap((f): OfferedService[] => {
    const c = s.services[f.key]
    if (!c.on) return []
    if (c.provider === 'nextchapter') return tierIncludes(tier, f.key) ? [{ ...f, provider: c.provider, href: f.nextchapter!.href, note: null }] : []
    return c.url || c.note ? [{ ...f, provider: c.provider, href: c.url, note: c.note }] : []
  })
}

// What one person gets: everything offered, or only their package's share.
export function servicesForPackage(json: unknown, tier: OutplacementTier | null, packageKey: string | null): OfferedService[] {
  const offered = offeredFeatures(json, tier)
  if (!packageKey || packageKey === EVERYONE) return offered
  const pkg = readProgramSettings(json).packages.find((p) => p.key === packageKey)
  return pkg ? offered.filter((f) => pkg.services.includes(f.key)) : offered
}

export function highestTier(tiers: OutplacementTier[]): OutplacementTier | null {
  return tiers.reduce<OutplacementTier | null>((best, t) => (!best || RANK[t] > RANK[best] ? t : best), null)
}
