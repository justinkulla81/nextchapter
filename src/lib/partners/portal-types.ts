// The five kinds of portal that are not the candidate site. Each has its own chrome color and a fixed label so a
// signed-in person always knows which portal they are in. A customer's own brand (logo, color) stays a logo and a thin
// rule; it never replaces the portal-type color (see PartnerTopBar and docs/candidate-redesign.md).
//
// Who pays: higher education, employer and workforce are paying customers (B2B). Recruiters and coaches are
// B2B2C: they bring candidates to the platform and may pay one day, so nothing in the labels says who pays.

export type PortalType = 'higher_ed' | 'employer' | 'workforce' | 'recruiter' | 'coach'

export interface PortalTypeInfo {
  key: PortalType
  /** The label at the top of every page in the portal. Sentence case. */
  label: string
  /** What this kind of portal is for, after the label ("Employer · Outplacement"). One per product inside the portal. */
  uses: string[]
  /** Chrome (top bar) color, hex. White text on it passes WCAG AA. */
  chrome: string
}

export const PORTAL_TYPES: Record<PortalType, PortalTypeInfo> = {
  employer: { key: 'employer', label: 'Employer', uses: ['Outplacement', 'Retention', 'Learning and development', 'Job retraining', 'Hiring'], chrome: '#0b2545' },
  higher_ed: { key: 'higher_ed', label: 'Higher education', uses: ['Career services', 'Alumni'], chrome: '#6b1d2a' },
  workforce: { key: 'workforce', label: 'Workforce', uses: ['Workforce boards', 'Economic development'], chrome: '#1e4d3a' },
  recruiter: { key: 'recruiter', label: 'Recruiter', uses: [], chrome: '#3a3f7a' },
  coach: { key: 'coach', label: 'Coach', uses: [], chrome: '#0e6672' },
}

export const PORTAL_TYPE_ORDER: PortalType[] = ['employer', 'higher_ed', 'workforce', 'recruiter', 'coach']

/**
 * The three employer sections follow the employee lifecycle (src/lib/employer/sections.ts). Retention, Learning and
 * development and Job retraining are services inside Employees, so their label names the section first.
 */
const EMPLOYER_USE_SECTION: Record<string, string> = {
  Retention: 'Employees',
  'Learning and development': 'Employees',
  'Job retraining': 'Employees',
}

/** "Employer · Outplacement", "Employer · Employees · Retention", or just "Recruiter" when the portal has one purpose. */
export function portalTypeLabel(type: PortalType, use?: string | null): string {
  const info = PORTAL_TYPES[type]
  if (!use || !info.uses.includes(use)) return info.label
  const section = type === 'employer' ? EMPLOYER_USE_SECTION[use] : undefined
  return section ? `${info.label} · ${section} · ${use}` : `${info.label} · ${use}`
}

/**
 * The employer portal is separately claimable, separately paid parts. The part shown in the top bar follows the route:
 * Growth (retention contracts) and Learning (learning and development contracts) have their own; every other
 * employer page belongs to Outplacement. "Job retraining" is declared but has no pages yet.
 */
export function employerUseForPath(pathname: string | null | undefined): string {
  const path = pathname ?? ''
  const under = (base: string) => path === base || path.startsWith(`${base}/`)
  if (under('/employer/growth')) return 'Retention'
  if (under('/employer/learning')) return 'Learning and development'
  return 'Outplacement'
}
