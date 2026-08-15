import 'server-only'
import { prisma } from '@/lib/prisma'
import type { BenefitsNetworkListing } from '@prisma/client'

export interface BenefitsNetworkFilters {
  function?: string
  level?: string
  format?: string
  costType?: string
  timeCommitment?: string
  credentialType?: string
}

export type BenefitsNetworkListingWithAlum = BenefitsNetworkListing & {
  alum: { id: string; firstName: string | null; lastName: string | null }
  _count: { ratings: number; redemptions: number }
  avgRating: number | null
}

// §A4.4 auto-expiry -- "a listing past its expiry date stops showing in the
// catalog." Enforced directly in this WHERE clause (immediate correctness,
// no dependency on the expire-listings cron having run yet); the cron is a
// belt-and-suspenders fix for admin's own listing table, not what actually
// keeps expired offers out of the candidate-facing catalog.
export async function getCatalogListings(filters: BenefitsNetworkFilters = {}): Promise<BenefitsNetworkListingWithAlum[]> {
  const listings = await prisma.benefitsNetworkListing.findMany({
    where: {
      status: 'LISTED',
      expiresAt: { gt: new Date() },
      ...(filters.function ? { function: filters.function } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.format ? { format: filters.format } : {}),
      ...(filters.costType ? { costType: filters.costType } : {}),
      ...(filters.timeCommitment ? { timeCommitment: filters.timeCommitment } : {}),
      ...(filters.credentialType ? { credentialType: filters.credentialType } : {}),
    },
    include: {
      alum: { select: { id: true, firstName: true, lastName: true } },
      ratings: { select: { rating: true } },
      _count: { select: { ratings: true, redemptions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return listings.map(({ ratings, ...listing }) => ({
    ...listing,
    avgRating: ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null,
  }))
}

export async function getListingForCandidate(listingId: string): Promise<BenefitsNetworkListingWithAlum | null> {
  const listing = await prisma.benefitsNetworkListing.findUnique({
    where: { id: listingId },
    include: {
      alum: { select: { id: true, firstName: true, lastName: true } },
      ratings: { select: { rating: true } },
      _count: { select: { ratings: true, redemptions: true } },
    },
  })
  if (!listing) return null
  const { ratings, ...rest } = listing
  return {
    ...rest,
    avgRating: ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null,
  }
}
