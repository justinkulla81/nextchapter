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
  employer: { key: 'employer', label: 'Employer', uses: ['Outplacement', 'Hiring', 'Retention'], chrome: '#0b2545' },
  higher_ed: { key: 'higher_ed', label: 'Higher education', uses: ['Career services', 'Alumni'], chrome: '#6b1d2a' },
  workforce: { key: 'workforce', label: 'Workforce', uses: ['Workforce boards', 'Economic development'], chrome: '#1e4d3a' },
  recruiter: { key: 'recruiter', label: 'Recruiter', uses: [], chrome: '#3a3f7a' },
  coach: { key: 'coach', label: 'Coach', uses: [], chrome: '#6b4a1f' },
}

export const PORTAL_TYPE_ORDER: PortalType[] = ['employer', 'higher_ed', 'workforce', 'recruiter', 'coach']

/** "Employer · Outplacement", or just "Recruiter" when the portal has one purpose. */
export function portalTypeLabel(type: PortalType, use?: string | null): string {
  const info = PORTAL_TYPES[type]
  return use && info.uses.includes(use) ? `${info.label} · ${use}` : info.label
}
