// What an outplacement buyer offers its people: each service in its
// contract tier can be switched off, and the program gets a welcome
// message. Client-safe (the settings form reads it). Stored in
// OutplacementEmployerOrg.programSettings; anything not stored is on, but
// nothing is ever on beyond what the tier includes.

import type { OutplacementTier } from '@prisma/client'

export type ProgramFeatureKey = 'coaching' | 'resume' | 'dossier' | 'recruiters' | 'marketIntel' | 'interim' | 'alumniMembership'

const RANK: Record<OutplacementTier, number> = { CORE: 0, PLUS: 1, PREMIUM: 2 }

export const PROGRAM_FEATURES: { key: ProgramFeatureKey; label: string; what: string; minTier: OutplacementTier; href: string }[] = [
  { key: 'coaching', label: 'Coaching', what: 'One-to-one sessions with a NextChapter coach (Plus: 6, Premium: 12 and a named coach).', minTier: 'PLUS', href: '/dashboard/coaching-match' },
  { key: 'resume', label: 'Resume Studio', what: 'Resume builder and ATS check; human reviews on Plus and Premium.', minTier: 'CORE', href: '/dashboard/resume' },
  { key: 'dossier', label: 'Executive Dossier', what: 'A verified profile they can share with employers.', minTier: 'CORE', href: '/dossier' },
  { key: 'recruiters', label: 'Recruiter network', what: 'Introductions to recruiters in their field.', minTier: 'CORE', href: '/dashboard/recruiter-requests' },
  { key: 'marketIntel', label: 'Market Intelligence', what: 'Who is hiring, pay ranges and layoff signals for their target roles.', minTier: 'CORE', href: '/dashboard/market-intelligence' },
  { key: 'interim', label: 'Interim and fractional work', what: 'Interim roles, board seats and fractional openings.', minTier: 'CORE', href: '/dashboard/interim-work' },
  { key: 'alumniMembership', label: 'Free membership after they land', what: 'A year of NextChapter membership once they report a new job.', minTier: 'PREMIUM', href: '/dashboard/membership' },
]

export type ProgramSettings = { features: Partial<Record<ProgramFeatureKey, boolean>>; welcome: string | null }

export function readProgramSettings(json: unknown): ProgramSettings {
  const o = (json ?? {}) as { features?: Record<string, unknown>; welcome?: unknown }
  const features = Object.fromEntries(Object.entries(o.features ?? {}).filter(([, v]) => typeof v === 'boolean')) as ProgramSettings['features']
  return { features, welcome: typeof o.welcome === 'string' && o.welcome.trim() ? o.welcome.trim().slice(0, 1000) : null }
}

export function tierIncludes(tier: OutplacementTier | null, key: ProgramFeatureKey): boolean {
  const f = PROGRAM_FEATURES.find((x) => x.key === key)
  return !!tier && !!f && RANK[tier] >= RANK[f.minTier]
}

// The services this org's people get: in the tier and not switched off.
export function offeredFeatures(json: unknown, tier: OutplacementTier | null) {
  const s = readProgramSettings(json)
  return PROGRAM_FEATURES.filter((f) => tierIncludes(tier, f.key) && s.features[f.key] !== false)
}

export function highestTier(tiers: OutplacementTier[]): OutplacementTier | null {
  return tiers.reduce<OutplacementTier | null>((best, t) => (!best || RANK[t] > RANK[best] ? t : best), null)
}
