import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { isTrustedOwnerIp, isLoopbackIp } from '@/lib/http/trusted-ips'
import { createClient } from '@/lib/supabase/server'
import { HOME_AB_COOKIE, homeAbStamp, isHomePath } from '@/lib/home-ab'

// Hit by the client-side HomepageVisitTracker beacon — never blocks
// navigation (fire-and-forget from the browser), so failures here are
// swallowed rather than surfaced anywhere.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = body?.eventType === 'LINK_CLICK' ? 'LINK_CLICK' : 'PAGE_VIEW'
    const href = typeof body?.href === 'string' ? body.href.slice(0, 500) : null
    const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
    // Client-supplied document.referrer (see HomepageVisitTracker.tsx) —
    // NOT the request's own Referer header, which for this same-origin
    // beacon POST is always the tracking page's own URL, never the true
    // external source (google.com, youtube.com, an email client, etc.).
    // That was a real bug: every row's `referrer` column read as the
    // site's own URL, useless for traffic-source classification.
    const referrer = typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null

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

    // Homepage test (src/lib/home-ab.ts): a homepage view by an assigned visitor carries its variant in `href`, which a
    // PAGE_VIEW otherwise leaves empty. The path stays "/", so every report that groups by path is unchanged.
    const stamp = eventType === 'PAGE_VIEW' && isHomePath(path) ? homeAbStamp(request.cookies.get(HOME_AB_COOKIE)?.value) : null

    await prisma.homepageVisitEvent.create({
      data: {
        ip,
        eventType,
        // LINK_CLICK now records the page it happened on too (older click rows have null).
        path,
        href: eventType === 'LINK_CLICK' ? href : stamp,
        referrer: eventType === 'PAGE_VIEW' ? referrer : null,
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
