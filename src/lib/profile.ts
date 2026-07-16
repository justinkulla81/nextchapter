import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
export const getOrCreateCandidateProfile = cache(async (userId: string, coachId?: string) => {
  try {
    return await prisma.candidateProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, coachId },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.candidateProfile.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
})

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
