// Roles inside each employer section (owner decision 2026-10-25) and the last-admin rule every section shares.
// Pure: no database, no auth.
//
//   Hiring        ADMIN, VIEWER, BILLING   (today's OWNER and MEMBER, renamed in name only)
//   Employees     ADMIN, VIEWER, BILLING   (today uses the outplacement ADMIN and VIEWER)
//   Outplacement  ADMIN, VIEWER, LEGAL, FINANCE   (unchanged)
//
// BILLING is per section for now. One organization-wide billing role comes later, with billing (not built).

import type { EmployerSectionKey } from '@/lib/employer/sections'

export const SECTION_ROLES: Record<EmployerSectionKey, readonly string[]> = {
  hiring: ['ADMIN', 'VIEWER', 'BILLING'],
  employees: ['ADMIN', 'VIEWER', 'BILLING'],
  outplacement: ['ADMIN', 'VIEWER', 'LEGAL', 'FINANCE'],
}

export function isSectionRole(section: EmployerSectionKey, role: unknown): role is string {
  return typeof role === 'string' && SECTION_ROLES[section].includes(role)
}

/** The first grant (legacy grants come first in the list) whose role is one of the allowed roles. */
export function firstAllowed<T extends { role: string }>(grants: T[], allowed: readonly string[]): T | null {
  return grants.find((g) => allowed.includes(g.role)) ?? null
}

export interface AdminTarget {
  /** The person's user id once they have signed in; null for a pending invite. */
  userId: string | null
  role: string
  /** Has signed in and accepted. A pending invite does not count as an admin who can run the account. */
  active: boolean
}

/**
 * Why removing this person, or taking their ADMIN role away, must be refused, or null if it is allowed. Every section
 * applies the same rule (the one outplacement's removeOrgUser already had): never yourself, never the last active admin.
 * `activeAdmins` counts everyone who is ADMIN and has signed in, including the target.
 */
export function lastAdminBlock(actorUserId: string, target: AdminTarget, activeAdmins: number, action: 'remove' | 'change_role' = 'remove'): string | null {
  if (action === 'remove' && target.userId && target.userId === actorUserId) return 'You can’t remove yourself. Ask another admin.'
  if (target.role === 'ADMIN' && target.active && activeAdmins <= 1) {
    return action === 'remove' ? 'This is the only active admin. Invite another admin first.' : 'This is the only active admin. Make someone else an admin first.'
  }
  return null
}
