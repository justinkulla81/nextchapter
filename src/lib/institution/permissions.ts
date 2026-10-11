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
  VIEWER: ['view'],
}

export function can(role: InstitutionUserRole, capability: InstitutionCapability): boolean {
  return CAPABILITIES[role].includes(capability)
}

export const ROLE_LABEL: Record<InstitutionUserRole, string> = {
  INSTITUTION_ADMIN: 'Administrator',
  CAREER_SERVICES: 'Career services',
  EMPLOYER_RELATIONS: 'Employer relations',
  ALUMNI_RELATIONS: 'Alumni relations',
  DEVELOPMENT: 'Development',
  VIEWER: 'Viewer',
}
