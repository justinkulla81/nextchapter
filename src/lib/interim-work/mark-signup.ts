import 'server-only'
import { prisma } from '@/lib/prisma'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { logCatalogAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'
import type { InterimSignupSource } from '@prisma/client'

// Shared by the manual "I created a profile" self-report action
// (dashboard/interim-work/actions.ts) and the Gmail auto-detection block in
// sync-gmail.ts — same points/idempotency logic either way, source is only
// a label for which path found it. @@unique([candidateId, listingId]) on
// InterimMarketplaceSignup makes this naturally idempotent regardless of
// which source calls it first for a given (candidate, listing) pair.
export async function markInterimMarketplaceSignupCore(
  candidateId: string,
  listingId: string,
  source: InterimSignupSource
): Promise<void> {
  const listing = await prisma.interimListing.findUnique({ where: { id: listingId } })
  if (!listing) return

  const result = await prisma.interimMarketplaceSignup.createMany({
    data: [{ candidateId, listingId, source }],
    skipDuplicates: true,
  })

  // Only award points/log the action the first time — skipDuplicates means
  // a repeat call here did nothing, so don't double-count it.
  if (result.count > 0) {
    const effort = estimateActionEffort({ actionType: 'INTERIM_PROFILE_CREATED' })
    await logCatalogAction(candidateId, {
      text: `Created a profile on ${listing.name}`,
      actionType: 'INTERIM_PROFILE_CREATED',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: false,
    })
    captureServerEvent(candidateId, 'interim_marketplace_signup_logged', {
      listingId,
      listingName: listing.name,
      source,
    })
  }
}
