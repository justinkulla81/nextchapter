import { prisma } from '@/lib/prisma'
import { InterimListingCategory } from '@prisma/client'

export async function getActiveListings(categories: InterimListingCategory[]) {
  if (categories.length === 0) return []
  return prisma.interimListing.findMany({
    where: { category: { in: categories }, isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })
}

export async function getSignedUpListingIds(candidateId: string): Promise<Set<string>> {
  const signups = await prisma.interimMarketplaceSignup.findMany({
    where: { candidateId },
    select: { listingId: true },
  })
  return new Set(signups.map((s) => s.listingId))
}
