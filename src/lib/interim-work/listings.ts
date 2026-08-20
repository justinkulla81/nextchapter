import { prisma } from '@/lib/prisma'
import { InterimListingCategory, type InterimSignupSource } from '@prisma/client'

export async function getActiveListings(categories: InterimListingCategory[]) {
  if (categories.length === 0) return []
  return prisma.interimListing.findMany({
    where: { category: { in: categories }, isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })
}

// Map, not Set — carries which source found each signup (self-reported vs
// Gmail-detected) so the UI can show a distinct "auto-detected" badge.
// Map.has() is a drop-in replacement everywhere the old Set.has() was used.
export async function getSignedUpListingIds(candidateId: string): Promise<Map<string, InterimSignupSource>> {
  const signups = await prisma.interimMarketplaceSignup.findMany({
    where: { candidateId },
    select: { listingId: true, source: true },
  })
  return new Map(signups.map((s) => [s.listingId, s.source]))
}

// Root-domain (last two hostname labels) -> listing, for matching an inbound
// email's sender domain against a real marketplace listing's own site — same
// extraction convention sync-gmail.ts already uses for its senderRootDomain.
// Malformed/relative URLs on file are skipped rather than thrown, since this
// reads live admin-entered data.
export async function getInterimListingDomainMap(): Promise<Map<string, { id: string; name: string }>> {
  const listings = await prisma.interimListing.findMany({
    where: { isActive: true },
    select: { id: true, name: true, url: true },
  })
  const map = new Map<string, { id: string; name: string }>()
  for (const listing of listings) {
    try {
      const rootDomain = new URL(listing.url).hostname.split('.').slice(-2).join('.')
      map.set(rootDomain, { id: listing.id, name: listing.name })
    } catch {
      // Malformed URL on file — skip rather than throw.
    }
  }
  return map
}
