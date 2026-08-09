import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { isTrustedOwnerIp, isLoopbackIp } from '@/lib/http/trusted-ips'

// Hit by the client-side HomepageVisitTracker beacon — never blocks
// navigation (fire-and-forget from the browser), so failures here are
// swallowed rather than surfaced anywhere.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = body?.eventType === 'LINK_CLICK' ? 'LINK_CLICK' : 'PAGE_VIEW'
    const href = typeof body?.href === 'string' ? body.href.slice(0, 500) : null

    const ip = await getClientIp()
    if (isTrustedOwnerIp(ip) || isLoopbackIp(ip)) {
      return NextResponse.json({ recorded: false })
    }

    await prisma.homepageVisitEvent.create({
      data: {
        ip,
        eventType,
        href: eventType === 'LINK_CLICK' ? href : null,
        referrer: eventType === 'PAGE_VIEW' ? request.headers.get('referer') : null,
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record homepage visit event:', error)
    return NextResponse.json({ recorded: false })
  }
}
