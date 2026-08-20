import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// The one real CandidateProfile (see scripts/create-system-account.ts) that
// authors admin-originated Community posts — cached per-request since every
// admin story submission needs it but it never changes within a request.
export const getSystemCandidateProfile = cache(async () => {
  return prisma.candidateProfile.findFirstOrThrow({ where: { isSystemAccount: true } })
})
