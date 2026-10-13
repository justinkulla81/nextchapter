import type { InstitutionUserRole } from '@prisma/client'

// What each college staff role may do in the institution portal. Pure, tested in
// src/test/institution-permissions.test.ts. Enforced at the page AND the action, never
// only by hiding a nav link.
export type InstitutionCapability = 'view' | 'post_jobs' | 'manage_target_companies'

const CAPABILITIES: Record<InstitutionUserRole, InstitutionCapability[]> = {
  INSTITUTION_ADMIN: ['view', 'post_jobs', 'manage_target_companies'],
  CAREER_SERVICES: ['view', 'post_jobs', 'manage_target_companies'],
  EMPLOYER_RELATIONS: ['view', 'post_jobs', 'manage_target_companies'],
  ALUMNI_RELATIONS: ['view', 'post_jobs'],
  DEVELOPMENT: ['view'],
  COACH: ['view'],
  FACULTY: ['view'],
  EXEC_ED: ['view'],
  WORKFORCE_PARTNER: ['view'],
  VIEWER: ['view'],
}

export function can(role: InstitutionUserRole, capability: InstitutionCapability): boolean {
  return CAPABILITIES[role].includes(capability)
}

// For the /i/[slug] portal, where one person can hold several roles (one
// InstitutionUser row each): true when any of them grants the capability.
export function canAny(roles: Iterable<string>, capability: InstitutionCapability): boolean {
  for (const r of roles) if (r in CAPABILITIES && can(r as InstitutionUserRole, capability)) return true
  return false
}

export const ROLE_LABEL: Record<InstitutionUserRole, string> = {
  INSTITUTION_ADMIN: 'Administrator',
  CAREER_SERVICES: 'Career services',
  EMPLOYER_RELATIONS: 'Employer relations',
  ALUMNI_RELATIONS: 'Alumni relations',
  DEVELOPMENT: 'Development',
  COACH: 'Coach',
  FACULTY: 'Faculty',
  EXEC_ED: 'Executive education',
  WORKFORCE_PARTNER: 'Workforce board partner',
  VIEWER: 'Viewer',
}
