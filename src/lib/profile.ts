import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'

// Prisma's upsert isn't atomic against a concurrent upsert for the same row
// (both can see "no row" and both attempt create), so a duplicate request —
// e.g. from a redirect chain — can trip the unique constraint on userId.
// Fall back to fetching the row that the other request just created.
//
// Wrapped in React's cache() so calling this more than once for the same
// userId within a single request (e.g. once from onboarding/layout.tsx, once
// from the page it wraps) only does the DB round trip once — Server Actions
// each get their own fresh cache scope, so this doesn't affect their
// behavior at all, it only dedupes redundant reads within one render pass.
export interface NewCandidateProfileLinks {
  coachId?: string
  sourcingRecruiterId?: string
}

export const getOrCreateCandidateProfile = cache(
  async (userId: string, links?: NewCandidateProfileLinks) => {
    const existing = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (existing) return existing

    try {
      const signupIp = await getClientIp()
      const profile = await prisma.candidateProfile.create({
        data: {
          userId,
          coachId: links?.coachId,
          sourcingRecruiterId: links?.sourcingRecruiterId,
          signupIp,
          // Every candidate created from here on is subject to the
          // dashboard-wide hard gate — existing rows keep the schema
          // default (false) and stay grandfathered. See the field's own
          // comment in schema.prisma.
          subjectToHardGate: true,
        },
      })

      // System-granted (grantedBy: null) — this is a person completing
      // their own signup, not an admin acting on someone else's behalf.
      // Fire-and-forget-safe to await here since this whole function only
      // runs once per userId (the findUnique above short-circuits every
      // later call) — see role-grants.ts for why this is idempotent even
      // if it somehow ran twice.
      await grantRoleIfMissing(userId, 'candidate')

      // No admin email here anymore — firstName/lastName/email are never
      // known at this point (this is the anonymous-session profile-create
      // path). See maybeNotifyAdminOfNewCandidate, called once those are
      // actually known (resume extraction, or the create-account email
      // fallback).
      return profile
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return prisma.candidateProfile.findUniqueOrThrow({ where: { userId } })
      }
      throw error
    }
  }
)

export const getOrCreateEmployerProfile = cache(async (userId: string, companyName = '') => {
  try {
    const profile = await prisma.employerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, companyName },
    })
    // EmployerProfile.userId is the account owner (see EmployerSeat's own
    // comment) — employer_admin, not employer_viewer. grantRoleIfMissing
    // is a no-op once granted, so calling it on every upsert (not just the
    // create branch) is safe and avoids needing to detect create-vs-update
    // here.
    await grantRoleIfMissing(userId, 'employer_admin')
    return profile
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.employerProfile.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
})

// NEN's own employer profile — deliberately a separate table from
// EmployerProfile above (see CrucibleEmployerProfile's schema comment for
// why): /talent's paid-tier, dossier-unlock-gated model doesn't fit NEN's
// free, Crucible-pass-gated candidate pool. Same upsert + P2002-catch +
// grantRoleIfMissing shape as getOrCreateEmployerProfile, targeting the
// nen_employer role instead of employer_admin.
export const getOrCreateCrucibleEmployerProfile = cache(async (userId: string, companyName = '') => {
  try {
    const profile = await prisma.crucibleEmployerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, companyName },
    })
    await grantRoleIfMissing(userId, 'nen_employer')
    return profile
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.crucibleEmployerProfile.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
})

// EQoverIQ's own contributor profile — same upsert + P2002-catch +
// grantRoleIfMissing shape as getOrCreateCrucibleEmployerProfile, targeting
// the eqoveriq_contributor role. Role grant happens unconditionally at
// account creation (it controls which portal a signed-in user lands in);
// the actual application-review status lives on the row itself and gates
// content within the portal, not access to it.
export const getOrCreateEqOverIqContributorProfile = cache(async (userId: string, fullName = '') => {
  try {
    const profile = await prisma.eqOverIqContributorProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, fullName },
    })
    await grantRoleIfMissing(userId, 'eqoveriq_contributor')
    return profile
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.eqOverIqContributorProfile.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
})
