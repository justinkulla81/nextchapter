import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { isTrustedOwnerIp, isLoopbackIp } from '@/lib/http/trusted-ips'
import { createClient } from '@/lib/supabase/server'

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

    // sendBeacon carries same-origin cookies, so a logged-in visitor's
    // Supabase session is available here — looked up read-only (never
    // getOrCreateCandidateProfile) so a logged-out majority of hits never
    // creates a profile row just from browsing the homepage.
    let candidateId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && !user.is_anonymous) {
        const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
        candidateId = profile?.id ?? null
      }
    } catch {
      // Session lookup failing must never block recording the visit.
    }

    await prisma.homepageVisitEvent.create({
      data: {
        ip,
        eventType,
        href: eventType === 'LINK_CLICK' ? href : null,
        referrer: eventType === 'PAGE_VIEW' ? request.headers.get('referer') : null,
        userAgent: request.headers.get('user-agent'),
        candidateId,
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record homepage visit event:', error)
    return NextResponse.json({ recorded: false })
  }
}
