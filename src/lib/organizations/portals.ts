// The six portal types an organization can own, and the connections between them.
// Pure data and rules; nothing here touches the database.

export type PortalType = 'HIGHER_ED' | 'OUTPLACEMENT' | 'WORKFORCE' | 'COACH' | 'HIRING' | 'RECRUITER'

export interface PortalMeta {
  type: PortalType
  label: string
  /** One line for the create form. */
  blurb: string
  /** Workforce boards are being built in a separate piece of work. */
  available: boolean
  /** What the partner's people are called in this portal. */
  peopleLabel: string
  /** Where the partner signs in. */
  signInPath: string
}

export const PORTALS: PortalMeta[] = [
  { type: 'HIGHER_ED', label: 'Higher ed', blurb: 'Alumni and student career services, mentoring, giving and outcomes.', available: true, peopleLabel: 'Alumni', signInPath: '/auth/login' },
  { type: 'OUTPLACEMENT', label: 'Outplacement', blurb: 'Seats for laid-off employees, a roster, a scorecard and invoices.', available: true, peopleLabel: 'Participants', signInPath: '/employer/login' },
  { type: 'WORKFORCE', label: 'Workforce board', blurb: 'Participants, providers and WIOA reporting. Built on the higher-ed engine.', available: false, peopleLabel: 'Participants', signInPath: '/auth/login' },
  { type: 'COACH', label: 'Coach or coaching firm', blurb: 'Clients, sessions, booking and impact reports.', available: true, peopleLabel: 'Clients', signInPath: '/support/coach/login' },
  { type: 'HIRING', label: 'Hiring team', blurb: 'Roles, a candidate inbox, scorecards and hiring analytics.', available: true, peopleLabel: 'Candidates', signInPath: '/talent/login' },
  { type: 'RECRUITER', label: 'Recruiter firm', blurb: 'Searches, consented introductions, submissions and placements.', available: true, peopleLabel: 'Candidates', signInPath: '/recruiters/login' },
]

export function portalMeta(type: PortalType): PortalMeta {
  return PORTALS.find((p) => p.type === type) as PortalMeta
}

export function isPortalType(v: unknown): v is PortalType {
  return typeof v === 'string' && PORTALS.some((p) => p.type === v)
}

// ── Connections between portals ─────────────────────────────────────────────
// Each connection needs two portals owned by the same organization. They are on
// by default when both exist, and an admin can turn any off.

export interface IntegrationMeta {
  key: IntegrationKey
  label: string
  /** What turning it on does, in plain words. */
  does: string
  needs: [PortalType, PortalType | PortalType[]]
}

export type IntegrationKey = 'coachesServeMembers' | 'recruitersMeetMembers' | 'hiringReachesMembers' | 'combinedOutcomes'

export const INTEGRATIONS: IntegrationMeta[] = [
  {
    key: 'coachesServeMembers',
    label: 'Coaches serve this organization’s people',
    does: 'Members of the higher-ed or outplacement program can book the organization’s coaches, and sessions count toward the program.',
    needs: ['COACH', ['HIGHER_ED', 'OUTPLACEMENT']],
  },
  {
    key: 'recruitersMeetMembers',
    label: 'Recruiters can request introductions',
    does: 'The recruiter firm can ask to meet the program’s people. Each introduction still needs that person’s consent.',
    needs: ['RECRUITER', ['HIGHER_ED', 'OUTPLACEMENT']],
  },
  {
    key: 'hiringReachesMembers',
    label: 'Hiring team reaches this organization’s people',
    does: 'Roles the hiring team posts show to the program’s people first, and the hiring team sees Candidate+ members from the program.',
    needs: ['HIRING', ['HIGHER_ED', 'OUTPLACEMENT']],
  },
  {
    key: 'combinedOutcomes',
    label: 'One outcomes view across portals',
    does: 'The organization’s reports combine every portal it owns, with small groups hidden.',
    needs: ['HIGHER_ED', ['OUTPLACEMENT', 'COACH', 'RECRUITER', 'HIRING']],
  },
]

/** Whether the organization owns what a connection needs. */
export function integrationApplies(meta: IntegrationMeta, owned: PortalType[]): boolean {
  const [first, second] = meta.needs
  const seconds = Array.isArray(second) ? second : [second]
  return owned.includes(first) && seconds.some((t) => owned.includes(t))
}

export type FeatureFlags = Partial<Record<IntegrationKey, boolean>>

/** Stored flags merged over the defaults: on wherever the connection applies. */
export function resolveIntegrations(stored: unknown, owned: PortalType[]): Record<IntegrationKey, boolean> {
  const flags = (stored && typeof stored === 'object' ? stored : {}) as FeatureFlags
  const out = {} as Record<IntegrationKey, boolean>
  for (const m of INTEGRATIONS) {
    const applies = integrationApplies(m, owned)
    out[m.key] = applies && flags[m.key] !== false
  }
  return out
}
