// The employer side is one organization with three sections, one per stage of the employee lifecycle. Each section can
// be claimed by a different person and bought on its own, or all three as an enterprise package (owner decision
// 2026-10-24; docs/specs/employer-sections-build-plan.md).
//
// Pure data and rules. No database, no auth, no server-only import, so marketing pages and client components can read it.
// Nothing here changes who can sign in or where: it only describes which existing routes belong to which section.

export type EmployerSectionKey = 'hiring' | 'employees' | 'outplacement'

/** The OrgWorkspaceType value each section is stored as. */
export type EmployerWorkspaceType = 'HIRING' | 'EMPLOYEES' | 'OUTPLACEMENT'

export interface EmployerService {
  key: string
  section: EmployerSectionKey
  /** Sentence case, as shown in the top bar and navigation. */
  label: string
  /** One plain line for the overview. */
  blurb: string
  /** Route prefixes that belong to this service today. Empty when no pages exist yet. */
  routes: string[]
  built: boolean
}

export interface EmployerSection {
  key: EmployerSectionKey
  workspaceType: EmployerWorkspaceType
  label: string
  /** Whose lifecycle stage this is. */
  employees: string
  blurb: string
  /** Where people sign in today (unchanged by this file). */
  signInPath: string
  /** Where the section's app starts today. */
  homePath: string
  /** Route prefixes for the section's pages that are not one of its named services (overview, team, settings, invoices, ...). */
  otherRoutes: string[]
  services: EmployerService[]
}

export const EMPLOYER_SECTIONS: EmployerSection[] = [
  {
    key: 'hiring',
    workspaceType: 'HIRING',
    label: 'Hiring',
    employees: 'Future employees',
    blurb: 'Post roles, review candidates and see how your hiring is going.',
    signInPath: '/talent/login',
    homePath: '/talent/dashboard',
    otherRoutes: ['/talent'],
    services: [
      { key: 'roles', section: 'hiring', label: 'Roles', blurb: 'Open roles and who matches each one.', routes: ['/talent/roles', '/talent/job-board'], built: true },
      { key: 'candidate_inbox', section: 'hiring', label: 'Candidate inbox', blurb: 'Candidates who replied, messages and saved people in one place.', routes: ['/talent/candidates', '/talent/messages', '/talent/saved'], built: true },
      { key: 'scorecards', section: 'hiring', label: 'Scorecards', blurb: 'Rate every candidate against the same criteria.', routes: [], built: true },
      { key: 'analytics', section: 'hiring', label: 'Analytics', blurb: 'How long hiring takes and where candidates drop out.', routes: ['/talent/analytics'], built: true },
    ],
  },
  {
    key: 'employees',
    workspaceType: 'EMPLOYEES',
    label: 'Employees',
    employees: 'Current employees',
    blurb: 'Help the people you have grow, stay and move into new work.',
    signInPath: '/employer/login',
    homePath: '/employer',
    otherRoutes: [],
    services: [
      { key: 'learning', section: 'employees', label: 'Learning and development', blurb: 'Your own courses and a view of the skills gap.', routes: ['/employer/learning'], built: true },
      { key: 'retention', section: 'employees', label: 'Retention', blurb: 'Promotion and raise preparation, internal roles and team reporting.', routes: ['/employer/growth'], built: true },
      { key: 'retraining', section: 'employees', label: 'Job retraining', blurb: 'New skills for people whose jobs are changing.', routes: [], built: false },
    ],
  },
  {
    key: 'outplacement',
    workspaceType: 'OUTPLACEMENT',
    label: 'Outplacement',
    employees: 'Departing employees',
    blurb: 'Support for people leaving your company, with reporting for HR and legal.',
    signInPath: '/employer/login',
    homePath: '/employer',
    // Everything else under /employer is outplacement today (see employerUseForPath).
    otherRoutes: ['/employer'],
    services: [
      { key: 'seats', section: 'outplacement', label: 'Seats', blurb: 'Enroll the people leaving and manage who has a seat.', routes: ['/employer/enroll'], built: true },
      { key: 'roster', section: 'outplacement', label: 'Roster', blurb: 'Everyone enrolled and where they are.', routes: ['/employer/roster'], built: true },
      { key: 'scorecard', section: 'outplacement', label: 'Scorecard', blurb: 'Outcomes for your people, reported without names.', routes: ['/employer/reporting'], built: true },
      { key: 'compliance', section: 'outplacement', label: 'Compliance', blurb: 'The compliance pack for your legal team.', routes: ['/employer/compliance'], built: true },
    ],
  },
]

export const EMPLOYER_SECTION_ORDER: EmployerSectionKey[] = EMPLOYER_SECTIONS.map((s) => s.key)

export function employerSection(key: EmployerSectionKey): EmployerSection {
  return EMPLOYER_SECTIONS.find((s) => s.key === key) as EmployerSection
}

export function isEmployerSectionKey(v: unknown): v is EmployerSectionKey {
  return typeof v === 'string' && EMPLOYER_SECTIONS.some((s) => s.key === v)
}

export function allEmployerServices(): EmployerService[] {
  return EMPLOYER_SECTIONS.flatMap((s) => s.services)
}

/** The section a workspace type is, or null for a type that is not an employer section (higher education, coach, ...). */
export function sectionForWorkspaceType(type: string | null | undefined): EmployerSection | null {
  return EMPLOYER_SECTIONS.find((s) => s.workspaceType === type) ?? null
}

function under(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

function cleanPath(pathname: string | null | undefined): string {
  return (pathname ?? '').split('?')[0].split('#')[0].replace(/\/+$/, '')
}

/** The named service a path belongs to, or null (an overview, team or settings page, or a path outside the employer side). */
export function employerServiceForPath(pathname: string | null | undefined): EmployerService | null {
  const path = cleanPath(pathname)
  if (!path) return null
  return allEmployerServices().find((s) => s.routes.some((r) => under(path, r))) ?? null
}

/**
 * The section a path belongs to, or null outside the employer side. Mirrors how the routes work today: /talent is Hiring;
 * /employer/growth and /employer/learning are Employees; every other /employer page is Outplacement.
 */
export function employerSectionForPath(pathname: string | null | undefined): EmployerSection | null {
  const path = cleanPath(pathname)
  if (!path) return null
  const service = employerServiceForPath(path)
  if (service) return employerSection(service.section)
  const hiring = employerSection('hiring')
  if (hiring.otherRoutes.some((r) => under(path, r))) return hiring
  const outplacement = employerSection('outplacement')
  if (outplacement.otherRoutes.some((r) => under(path, r))) return outplacement
  return null
}

/** The employer sections an organization holds, from its workspace types, in display order. Other types are ignored. */
export function sectionsHeld(workspaceTypes: Array<string | null | undefined>): EmployerSection[] {
  const set = new Set(workspaceTypes)
  return EMPLOYER_SECTIONS.filter((s) => set.has(s.workspaceType))
}

/** The names after "Employer" in the top bar: ["Employees", "Learning and development"], ["Outplacement"], ["Hiring"], or [] outside the employer side. */
export function employerSectionTrail(pathname: string | null | undefined): string[] {
  const section = employerSectionForPath(pathname)
  if (!section) return []
  const service = employerServiceForPath(pathname)
  // A service is named only inside Employees. Hiring and Outplacement pages are labelled by their section.
  return section.key === 'employees' && service ? [section.label, service.label] : [section.label]
}
