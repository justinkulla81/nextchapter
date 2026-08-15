import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Extracted from regenerateDossierSections (src/app/dashboard/recruiter-
// report/actions.ts) so the Membership "annual Dossier refresh" benefit
// (§A2.4, src/app/api/cron/membership-dossier-refresh/route.ts) can trigger
// the exact same real regeneration a candidate gets from the manual
// "Regenerate" button, instead of building a parallel mechanism. Clears only
// the cached LLM generations -- the next render regenerates and re-caches
// via getCachedGenerations / getOrDraftPositioningStatement /
// getOrDraftSelfAwareness. Never touches positioningStatementText/
// selfAwarenessText (the human-approved columns).
export async function clearDossierGeneratedCache(candidateId: string): Promise<void> {
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      dossierGeneratedCache: Prisma.DbNull,
      dossierGeneratedAt: null,
      positioningStatementDraft: null,
      selfAwarenessDraft: null,
    },
  })
}
