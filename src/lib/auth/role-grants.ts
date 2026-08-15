import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RoleGrantRole } from '@prisma/client'

export type { RoleGrantRole }

// Single source of truth for "what roles does this identity currently
// hold" — reads the RoleGrant audit ledger (see prisma/schema.prisma)
// instead of separately querying CandidateProfile/Coach/Recruiter/
// EmployerProfile by userId, which is what redirect-non-candidate.ts did
// before this. Only active (non-revoked) grants count.
export async function getRoleGrants(userId: string): Promise<RoleGrantRole[]> {
  const grants = await prisma.roleGrant.findMany({
    where: { userId, revokedAt: null },
    select: { role: true },
    orderBy: { grantedAt: 'asc' },
  })
  // Defensive dedupe — grantRoleIfMissing() already guards against a
  // second active grant for the same (userId, role), this just keeps the
  // helper correct even if that invariant is ever violated by a direct
  // write (e.g. a future admin tool, a manual DB fix).
  return Array.from(new Set(grants.map((g) => g.role)))
}

export async function hasRoleGrant(userId: string, role: RoleGrantRole): Promise<boolean> {
  const roles = await getRoleGrants(userId)
  return roles.includes(role)
}

// Creates a new active grant for (userId, role) unless one already exists —
// the write side of the "only one active grant per (userId, role)"
// invariant that isn't enforced by the schema itself (see the model's own
// comment for why: revoke-then-regrant needs to preserve history as
// separate rows, so a hard unique constraint would be wrong).
//
// `grantedBy` is the Supabase auth userId of the admin who granted this
// role, or null for a system-granted role — the ordinary case, since every
// call site wired this phase (candidate registration, coach/recruiter/
// employer signup) is a person completing their own signup, not an admin
// acting on someone else's behalf.
export async function grantRoleIfMissing(
  userId: string,
  role: RoleGrantRole,
  grantedBy: string | null = null,
  grantedAt?: Date
): Promise<void> {
  const existing = await prisma.roleGrant.findFirst({
    where: { userId, role, revokedAt: null },
    select: { id: true },
  })
  if (existing) return

  await prisma.roleGrant.create({
    data: { userId, role, grantedBy, ...(grantedAt ? { grantedAt } : {}) },
  })
}

export async function revokeRoleGrant(
  userId: string,
  role: RoleGrantRole,
  revokedBy: string | null = null
): Promise<void> {
  await prisma.roleGrant.updateMany({
    where: { userId, role, revokedAt: null },
    data: { revokedAt: new Date(), revokedBy },
  })
}
