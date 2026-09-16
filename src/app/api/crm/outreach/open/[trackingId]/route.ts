import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// A single transparent GIF byte-for-byte, served for every open — the point
// is the request hitting this route, not the image itself.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64')

/**
 * Public by necessity, same reasoning as the click route: this URL is an
 * <img> src in an email delivered to an arbitrary mail client. Most clients
 * block remote images by default, so a missing open here is not proof the
 * email went unread — only a present one is a real signal.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params
  const tracking = await prisma.crmOutreachTracking.findUnique({ where: { id: trackingId } })
  if (tracking) {
    const now = new Date()
    await prisma.crmOutreachTracking.update({
      where: { id: trackingId },
      data: { openCount: { increment: 1 }, openedAt: tracking.openedAt ?? now, lastOpenedAt: now },
    })
  }

  return new NextResponse(PIXEL, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } })
}
