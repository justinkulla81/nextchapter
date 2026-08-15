// One-time backfill: creates a RoleGrant row for every existing
// CandidateProfile/Coach/Recruiter/EmployerProfile row, so the new audit
// ledger (see prisma/schema.prisma's RoleGrant model and
// src/lib/auth/role-grants.ts) reflects every role that already existed
// before it did, not just roles granted going forward.
//
// grantedAt is backfilled from the source row's own createdAt (falling back
// to now() only if that's ever missing, which shouldn't happen — every one
// of these models has a non-null createdAt with a database default).
// grantedBy is left null — these are all system-granted (self-signup), not
// admin-granted.
//
// Idempotent — skips any (userId, role) pair that already has an active
// grant, so it's safe to re-run after new signups have already created
// their own RoleGrant rows going forward (see the grantRoleIfMissing call
// sites in src/lib/profile.ts, recruiters/signup/actions.ts,
// support/coach/signup/actions.ts).
//
// Run: npm run backfill:role-grants

import { PrismaClient } from '@prisma/client'
import type { RoleGrantRole } from '@prisma/client'

const prisma = new PrismaClient()

interface SourceRow {
  userId: string
  createdAt: Date
}

async function backfillRole(
  label: string,
  role: RoleGrantRole,
  rows: SourceRow[]
): Promise<{ sourceCount: number; created: number; alreadyGranted: number }> {
  let created = 0
  let alreadyGranted = 0

  for (const row of rows) {
    const existing = await prisma.roleGrant.findFirst({
      where: { userId: row.userId, role, revokedAt: null },
      select: { id: true },
    })
    if (existing) {
      alreadyGranted++
      continue
    }
    await prisma.roleGrant.create({
      data: { userId: row.userId, role, grantedAt: row.createdAt, grantedBy: null },
    })
    created++
  }

  console.log(
    `${label}: ${rows.length} source rows -> ${created} RoleGrant rows created, ${alreadyGranted} already had an active grant.`
  )
  return { sourceCount: rows.length, created, alreadyGranted }
}

async function main() {
  // ── Snapshot: source row counts before ────────────────────────────────
  const [candidateCount, coachCount, recruiterCount, employerCount, roleGrantCountBefore] = await Promise.all([
    prisma.candidateProfile.count(),
    prisma.coach.count({ where: { userId: { not: null } } }),
    prisma.recruiter.count({ where: { userId: { not: null } } }),
    prisma.employerProfile.count(),
    prisma.roleGrant.count(),
  ])
  console.log('--- Before ---')
  console.log({ candidateCount, coachCount, recruiterCount, employerCount, roleGrantCountBefore })

  const [candidates, coaches, recruiters, employers] = await Promise.all([
    prisma.candidateProfile.findMany({ select: { userId: true, createdAt: true } }),
    prisma.coach.findMany({ where: { userId: { not: null } }, select: { userId: true, createdAt: true } }),
    prisma.recruiter.findMany({ where: { userId: { not: null } }, select: { userId: true, createdAt: true } }),
    prisma.employerProfile.findMany({ select: { userId: true, createdAt: true } }),
  ])

  const results = {
    candidate: await backfillRole('CandidateProfile -> candidate', 'candidate', candidates),
    coach: await backfillRole(
      'Coach -> coach',
      'coach',
      coaches.filter((c): c is SourceRow => !!c.userId).map((c) => ({ userId: c.userId!, createdAt: c.createdAt }))
    ),
    recruiter: await backfillRole(
      'Recruiter -> recruiter',
      'recruiter',
      recruiters.filter((r): r is SourceRow => !!r.userId).map((r) => ({ userId: r.userId!, createdAt: r.createdAt }))
    ),
    employer: await backfillRole('EmployerProfile -> employer_admin', 'employer_admin', employers),
  }

  // ── Snapshot-verify: every source row now has a matching active grant ──
  const roleGrantCountAfter = await prisma.roleGrant.count()
  const expectedNewGrants = Object.values(results).reduce((sum, r) => sum + r.created, 0)
  console.log('--- After ---')
  console.log({ roleGrantCountBefore, roleGrantCountAfter, expectedNewGrants })

  if (roleGrantCountAfter !== roleGrantCountBefore + expectedNewGrants) {
    throw new Error(
      `Snapshot mismatch: expected ${roleGrantCountBefore + expectedNewGrants} RoleGrant rows after backfill, found ${roleGrantCountAfter}.`
    )
  }

  // Verify every source row resolves to an active grant of the right role.
  const verifyMissing = async (label: string, role: RoleGrantRole, rows: SourceRow[]) => {
    const userIds = rows.map((r) => r.userId)
    if (userIds.length === 0) return
    const grantedUserIds = new Set(
      (
        await prisma.roleGrant.findMany({
          where: { userId: { in: userIds }, role, revokedAt: null },
          select: { userId: true },
        })
      ).map((g) => g.userId)
    )
    const missing = userIds.filter((id) => !grantedUserIds.has(id))
    if (missing.length > 0) {
      throw new Error(`${label}: ${missing.length} source rows have no matching active RoleGrant after backfill.`)
    }
    console.log(`${label}: verified all ${userIds.length} source rows have a matching active RoleGrant.`)
  }

  await verifyMissing('CandidateProfile', 'candidate', candidates)
  await verifyMissing(
    'Coach',
    'coach',
    coaches.filter((c): c is SourceRow => !!c.userId).map((c) => ({ userId: c.userId!, createdAt: c.createdAt }))
  )
  await verifyMissing(
    'Recruiter',
    'recruiter',
    recruiters.filter((r): r is SourceRow => !!r.userId).map((r) => ({ userId: r.userId!, createdAt: r.createdAt }))
  )
  await verifyMissing('EmployerProfile', 'employer_admin', employers)

  console.log('Backfill verified OK.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
