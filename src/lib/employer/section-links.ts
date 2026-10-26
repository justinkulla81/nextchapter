// Where each held employer section opens, for the section chooser (/employer-home), the top bar trail and the section
// switcher. Pure: no database, no auth. It only turns "which sections does this person hold" into links, and it can only
// produce a link for a section that is in the list it is given, so nothing here can point at a section the person lacks.

import { EMPLOYER_SECTIONS, employerSection, type EmployerSectionKey } from '@/lib/employer/sections'

export interface SectionLinkSource {
  sections: EmployerSectionKey[]
  grants: Array<{ section: EmployerSectionKey; services?: Record<string, boolean> }>
}

export interface SwitcherItem {
  key: EmployerSectionKey
  label: string
  /** The section's own sign-in path for the app (a main-site path; the caller turns it into the right host's address). */
  appPath: string
}

/**
 * The page a section opens on. Employees opens on the first built service that is on (Learning and development, then
 * Retention); the other two open on their usual home. Never a page the person's role could not open: Employees is only
 * held by ADMIN and VIEWER, who can open both service pages.
 */
export function sectionAppPath(section: EmployerSectionKey, services?: Record<string, boolean>): string {
  if (section === 'employees') {
    if (services?.learning) return '/employer/learning'
    if (services?.retention) return '/employer/growth'
  }
  return employerSection(section).homePath
}

/** The session cookie a section signs in to: Hiring uses the hiring ("talent") session; Employees and Outplacement the employer one. */
export function cookieOwnerForSection(section: EmployerSectionKey): 'talent' | 'employer' {
  return section === 'hiring' ? 'talent' : 'employer'
}

/** One item per held section, in display order. Sections not held are never listed. */
export function switcherItems(access: SectionLinkSource): SwitcherItem[] {
  const held = new Set(access.sections)
  return EMPLOYER_SECTIONS.filter((s) => held.has(s.key)).map((s) => {
    const withServices = access.grants.find((g) => g.section === s.key && g.services)
    return { key: s.key, label: s.label, appPath: sectionAppPath(s.key, withServices?.services) }
  })
}
