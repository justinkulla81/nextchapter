// The outplacement buyer's services menu: what the program offers, who
// delivers each service (NextChapter, or the company's own: its EAP, its
// benefits team, its internal job board), and packages (who gets what, e.g.
// "Executives" get coaching, everyone else doesn't). Client-safe; stored in
// OutplacementEmployerOrg.programSettings, a seat's package in
// OutplacementSeat.packageKey.
//
// A NextChapter service is never offered beyond what the contract tier
// includes. The company's own services don't depend on the tier.

import { readComms, type CensusComms } from '@/lib/census/comms-settings'
import type { OutplacementTier } from '@prisma/client'

export type ProgramFeatureKey =
  | 'coaching'
  | 'resume'
  | 'dossier'
  | 'recruiters'
  | 'jobBoard'
  | 'marketIntel'
  | 'interim'
  | 'careerPivot'
  | 'learning'
  | 'learningCommunity'
  | 'companyAlumni'
  | 'moneyBridge'
  | 'wellbeing'
  | 'alumniMembership'
  | 'benefits'
  | 'eap'
  | 'internalJobs'
  | 'severanceLegal'
  | 'financialPlanning'
  | 'healthCoverage'
  | 'retrainingStipend'
  | 'relocation'
  | 'startBusiness'
  | 'coworking'
  | 'references'

export type ProgramArea = 'Coaching and job search' | 'Career pivots and learning' | 'Community' | 'Money, health and wellbeing' | 'Practical help'
export const PROGRAM_AREAS: ProgramArea[] = ['Coaching and job search', 'Career pivots and learning', 'Community', 'Money, health and wellbeing', 'Practical help']

const RANK: Record<OutplacementTier, number> = { CORE: 0, PLUS: 1, PREMIUM: 2 }

export type ProgramFeature = {
  key: ProgramFeatureKey
  label: string
  what: string
  area: ProgramArea
  // NextChapter's version: the tier that includes it and where it lives.
  // Null = only the company can provide it.
  nextchapter: { minTier: OutplacementTier; href: string } | null
  // The company can provide its own version.
  ownAllowed: boolean
}

const nc = (minTier: OutplacementTier, href: string) => ({ minTier, href })
const C: ProgramArea = 'Coaching and job search'
const L: ProgramArea = 'Career pivots and learning'
const M: ProgramArea = 'Community'
const W: ProgramArea = 'Money, health and wellbeing'
const P: ProgramArea = 'Practical help'

export const PROGRAM_FEATURES: ProgramFeature[] = [
  { key: 'coaching', area: C, label: 'Coaching', what: 'One-to-one career coaching (Plus: 6 sessions, Premium: 12 and a named coach).', nextchapter: nc('PLUS', '/dashboard/coaching-match'), ownAllowed: true },
  { key: 'resume', area: C, label: 'Resume Studio', what: 'Resume builder and ATS check; human reviews on Plus and Premium.', nextchapter: nc('CORE', '/dashboard/resume'), ownAllowed: true },
  { key: 'dossier', area: C, label: 'Executive Dossier', what: 'A verified profile they can share with employers.', nextchapter: nc('CORE', '/dossier'), ownAllowed: false },
  { key: 'jobBoard', area: C, label: 'Job board', what: 'Openings matched to them, including roles only NextChapter members see.', nextchapter: nc('CORE', '/dashboard/find-my-job'), ownAllowed: false },
  { key: 'recruiters', area: C, label: 'Recruiter network', what: 'Introductions to recruiters in their field.', nextchapter: nc('CORE', '/dashboard/recruiter-requests'), ownAllowed: true },
  { key: 'marketIntel', area: C, label: 'Market Intelligence', what: 'Who is hiring, pay ranges and layoff signals for their target roles.', nextchapter: nc('CORE', '/dashboard/market-intelligence'), ownAllowed: false },
  { key: 'interim', area: C, label: 'Interim and fractional work', what: 'Interim roles, board seats and fractional openings.', nextchapter: nc('CORE', '/dashboard/interim-work'), ownAllowed: false },
  { key: 'internalJobs', area: C, label: 'Internal openings and rehire', what: 'Open roles at your company they can apply to.', nextchapter: null, ownAllowed: true },
  { key: 'careerPivot', area: L, label: 'Career pivot paths', what: 'Where people with their background moved next and the skills each move takes.', nextchapter: nc('CORE', '/dashboard/pivot-paths'), ownAllowed: false },
  { key: 'learning', area: L, label: 'Courses and certificates', what: 'Short courses that close the gaps their target roles ask for.', nextchapter: nc('CORE', '/dashboard/learning'), ownAllowed: true },
  { key: 'retrainingStipend', area: L, label: 'Retraining stipend', what: 'Money you set aside for a course or certificate.', nextchapter: null, ownAllowed: true },
  { key: 'learningCommunity', area: M, label: 'Learning and job-search groups', what: 'Small peer groups that learn or search together, week by week.', nextchapter: nc('CORE', '/dashboard/community'), ownAllowed: true },
  { key: 'companyAlumni', area: M, label: 'Company alumni network', what: 'Stay in touch with former colleagues; hear about roles they know of.', nextchapter: nc('CORE', '/dashboard/community'), ownAllowed: true },
  { key: 'alumniMembership', area: M, label: 'Free membership after they land', what: 'A year of NextChapter membership once they report a new job.', nextchapter: nc('PREMIUM', '/dashboard/membership'), ownAllowed: false },
  { key: 'moneyBridge', area: W, label: 'Unemployment, COBRA and budget help', what: 'Filing for unemployment, health coverage choices, and a budget to bridge the gap.', nextchapter: nc('CORE', '/dashboard/benefits'), ownAllowed: false },
  { key: 'benefits', area: W, label: 'Severance and benefits questions', what: 'Your HR or benefits team for severance, final pay and benefits end dates.', nextchapter: null, ownAllowed: true },
  { key: 'healthCoverage', area: W, label: 'Extended health coverage', what: 'COBRA subsidy or months of continued coverage you provide.', nextchapter: null, ownAllowed: true },
  { key: 'financialPlanning', area: W, label: 'Financial planning session', what: 'A session with a financial planner on severance, 401(k) and a runway.', nextchapter: null, ownAllowed: true },
  { key: 'eap', area: W, label: 'Counseling (EAP)', what: 'Your employee assistance program, if it continues after separation.', nextchapter: null, ownAllowed: true },
  { key: 'wellbeing', area: W, label: 'Support during the transition', what: 'Guidance for the stress of a job loss, and where to get help.', nextchapter: nc('CORE', '/dashboard/support'), ownAllowed: false },
  { key: 'severanceLegal', area: P, label: 'Severance agreement review', what: 'A lawyer reviews the agreement before they sign.', nextchapter: null, ownAllowed: true },
  { key: 'references', area: P, label: 'References and verification', what: 'Who will give a reference, and how employers verify employment.', nextchapter: null, ownAllowed: true },
  { key: 'relocation', area: P, label: 'Relocation help', what: 'Support if the next job means a move.', nextchapter: null, ownAllowed: true },
  { key: 'startBusiness', area: P, label: 'Starting a business', what: 'Advice and help for anyone going out on their own.', nextchapter: null, ownAllowed: true },
  { key: 'coworking', area: P, label: 'Coworking space', what: 'A desk outside the house while they search.', nextchapter: null, ownAllowed: true },
]

export type Provider = 'nextchapter' | 'own'
export type ServiceChoice = { on: boolean; provider: Provider; url: string | null; note: string | null }
export type ProgramPackage = { key: string; name: string; services: ProgramFeatureKey[] }
export type ProgramSettings = {
  welcome: string | null
  services: Record<ProgramFeatureKey, ServiceChoice>
  packages: ProgramPackage[]
  comms: CensusComms
}

export const EVERYONE = 'all'

export function tierIncludes(tier: OutplacementTier | null, key: ProgramFeatureKey): boolean {
  const f = PROGRAM_FEATURES.find((x) => x.key === key)
  return !!tier && !!f?.nextchapter && RANK[tier] >= RANK[f.nextchapter.minTier]
}

function defaultChoice(f: ProgramFeature): ServiceChoice {
  // NextChapter's services start on; the company's own start off until it adds a link or note.
  return { on: !!f.nextchapter, provider: f.nextchapter ? 'nextchapter' : 'own', url: null, note: null }
}

export function readProgramSettings(json: unknown): ProgramSettings {
  const o = (json ?? {}) as { features?: Record<string, unknown>; services?: Record<string, Partial<ServiceChoice>>; packages?: unknown; welcome?: unknown }
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
  return { welcome: typeof o.welcome === 'string' && o.welcome.trim() ? o.welcome.trim().slice(0, 1000) : null, services, packages, comms: readComms(json) }
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
