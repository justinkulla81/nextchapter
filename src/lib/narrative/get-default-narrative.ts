import 'server-only'
import { prisma } from '@/lib/prisma'

// The single "default" narrative shown wherever the app needs one without
// asking the candidate to pick a scenario — the earliest-created row (the
// original "My Story", before any named-scenario variants existed). Was
// duplicated inline in interview-prep/page.tsx; centralized here so the
// Learning page's Interview Skills section (Phase 8) uses the exact same
// definition instead of re-deriving it.
export function getDefaultNarrative(candidateId: string) {
  return prisma.candidateNarrative.findFirst({
    where: { candidateId },
    orderBy: { generatedAt: 'asc' },
  })
}
