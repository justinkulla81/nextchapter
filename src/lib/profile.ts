import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { sendAdminNewCandidateAccountEmail } from '@/lib/email/send-admin-new-candidate-account'

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

      const adminEmail = getAccountActivityAdminEmail()
      if (adminEmail) {
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Unnamed'
        sendAdminNewCandidateAccountEmail(adminEmail, profile.id, name, signupIp).catch(() => {})
      }

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
    return await prisma.employerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, companyName },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.employerProfile.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
})
