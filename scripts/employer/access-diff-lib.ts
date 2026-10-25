import type { EmployerAccess, EmployerAccessDb } from '@/lib/employer/access'
import type { EmployerSectionKey } from '@/lib/employer/sections'

// The check behind scripts/employer/access-diff.ts. `legacyGrants` re-derives today's access from the old tables with its
// own queries (deliberately not sharing code with getEmployerAccess, so a mistake in one shows up as a difference).
// `compareAccess` says whether the new result is a superset of it. Read only: it needs nothing but read methods.

export interface LegacyGrant {
  section: EmployerSectionKey
  role: string
  recordId: string
}

export async function legacyGrants(db: EmployerAccessDb, userId: string): Promise<LegacyGrant[]> {
  const out: LegacyGrant[] = []

  // Hiring: resolveEmployerForUserId. Owner first, then an accepted seat.
  const owned = await db.employerProfile.findUnique({ where: { userId }, select: { id: true } })
  if (owned) out.push({ section: 'hiring', role: 'ADMIN', recordId: owned.id })
  else {
    const seat = await db.employerSeat.findFirst({ where: { userId, acceptedAt: { not: null } }, select: { role: true, employerId: true } })
    if (seat) out.push({ section: 'hiring', role: seat.role === 'OWNER' ? 'ADMIN' : 'VIEWER', recordId: seat.employerId })
  }

  // Outplacement: getCurrentOutplacementOrgUser (any row with this user id, accepted or not).
  const orgUser = await db.outplacementOrgUser.findUnique({ where: { userId }, select: { role: true, orgId: true } })
  if (orgUser) {
    out.push({ section: 'outplacement', role: orgUser.role, recordId: orgUser.orgId })
    // Employees: the Growth and Learning pages need ADMIN or VIEWER and an ACTIVE contract of that type.
    if (orgUser.role === 'ADMIN' || orgUser.role === 'VIEWER') {
      const n = await db.outplacementContract.count({ where: { orgId: orgUser.orgId, status: 'ACTIVE', programType: { in: ['GROWTH', 'LEARNING'] } } })
      if (n > 0) out.push({ section: 'employees', role: orgUser.role, recordId: orgUser.orgId })
    }
  }
  return out
}

export interface AccessDifference {
  userId: string
  missing: LegacyGrant[]
}

/** Every legacy grant must appear in the new access with the same section, role and record. */
export function compareAccess(userId: string, legacy: LegacyGrant[], access: EmployerAccess): AccessDifference | null {
  const missing = legacy.filter((l) => !access.grants.some((g) => g.section === l.section && g.role === l.role && g.recordId === l.recordId))
  return missing.length ? { userId, missing } : null
}

export interface DiffReport {
  usersChecked: number
  usersWithAccess: number
  differences: AccessDifference[]
  /** Grants the new function adds that today's checks do not give (zero until OrgWorkspaceAdmin is backfilled). */
  addedGrants: number
}

export async function runDiff(
  db: EmployerAccessDb,
  userIds: string[],
  resolve: (userId: string) => Promise<EmployerAccess>,
  onProgress?: (done: number, total: number) => void
): Promise<DiffReport> {
  const differences: AccessDifference[] = []
  let usersWithAccess = 0
  let addedGrants = 0
  let done = 0
  for (const userId of userIds) {
    const legacy = await legacyGrants(db, userId)
    const access = await resolve(userId)
    if (legacy.length) usersWithAccess++
    const diff = compareAccess(userId, legacy, access)
    if (diff) differences.push(diff)
    addedGrants += access.grants.filter((g) => !legacy.some((l) => l.section === g.section && l.role === g.role && l.recordId === g.recordId)).length
    done++
    if (onProgress && done % 200 === 0) onProgress(done, userIds.length)
  }
  return { usersChecked: userIds.length, usersWithAccess, differences, addedGrants }
}
