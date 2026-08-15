import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// §A4.4 "every offer has ... a review date, and auto-expiry." The catalog
// query itself already filters out expired listings in real time (see
// getCatalogListings, src/lib/benefits-network/listings.ts) — this cron is
// the belt-and-suspenders half: it keeps admin's own listing table honest by
// flipping status to EXPIRED so a dead listing doesn't sit there forever
// still labeled "Listed."
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.benefitsNetworkListing.updateMany({
    where: { status: 'LISTED', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })

  captureServerEvent('system', 'benefits_network_listings_expired', { count: result.count })
  return NextResponse.json({ expired: result.count })
}
