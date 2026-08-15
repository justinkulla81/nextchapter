'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

// §A4.4 "delisting process" — admin action. Same toggleXActive shape as
// toggleInterimListingActive (src/app/support/admin/(portal)/interim-
// listings/actions.ts), applied to the richer BenefitsListingStatus enum
// instead of a plain boolean.
export async function delistBenefitsNetworkListing(listingId: string) {
  const admin = await requireAdmin()

  await prisma.benefitsNetworkListing.update({
    where: { id: listingId },
    data: { status: 'DELISTED' },
  })

  captureServerEvent(admin?.email ?? 'admin', 'benefits_listing_delisted', { listingId })
  revalidatePath('/support/admin/benefits-network')
  revalidatePath('/dashboard/benefits-network')
}

export async function relistBenefitsNetworkListing(listingId: string) {
  const admin = await requireAdmin()

  const listing = await prisma.benefitsNetworkListing.findUniqueOrThrow({ where: { id: listingId } })
  const status = listing.expiresAt < new Date() ? 'EXPIRED' : 'LISTED'

  await prisma.benefitsNetworkListing.update({
    where: { id: listingId },
    data: { status },
  })

  captureServerEvent(admin?.email ?? 'admin', 'benefits_listing_relisted', { listingId, status })
  revalidatePath('/support/admin/benefits-network')
  revalidatePath('/dashboard/benefits-network')
}

// §A4.4 "member reports it in one tap" — the review half. No auto-delist;
// this only marks the report reviewed/dismissed, mirroring the human-
// judgment-required pattern this session has used for every other
// removal/exclusion consequence.
export async function reviewBenefitsNetworkReport(reportId: string, status: 'REVIEWED' | 'DISMISSED') {
  const admin = await requireAdmin()

  await prisma.benefitsNetworkReport.update({
    where: { id: reportId },
    data: { status, reviewedBy: admin?.email ?? null, reviewedAt: new Date() },
  })

  captureServerEvent(admin?.email ?? 'admin', 'benefits_listing_report_reviewed', { reportId, status })
  revalidatePath('/support/admin/benefits-network')
}
