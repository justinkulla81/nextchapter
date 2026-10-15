import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

// §A4.4 "every offer has ... a review date, and auto-expiry." The catalog
// query itself already filters out expired listings in real time (see
// getCatalogListings, src/lib/benefits-network/listings.ts) — this cron is
// the belt-and-suspenders half: it keeps admin's own listing table honest by
// flipping status to EXPIRED so a dead listing doesn't sit there forever
// still labeled "Listed."
export const GET = withCronRun('benefits-network-expire-listings', async () => {
  const result = await prisma.benefitsNetworkListing.updateMany({
    where: { status: 'LISTED', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })

  captureServerEvent('system', 'benefits_network_listings_expired', { count: result.count })
  return NextResponse.json({ expired: result.count })
})
