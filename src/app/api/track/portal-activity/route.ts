import { NextResponse, type NextRequest } from 'next/server'
import type { PortalKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const PORTALS: PortalKind[] = ['COACH', 'RECRUITER', 'EMPLOYER', 'TALENT', 'CRUCIBLE_EMPLOYER', 'EQOVERIQ_CONTRIBUTOR']

// Hit by the PortalActivityTracker beacon in each partner portal layout.
// Fire-and-forget from the browser: failures are swallowed so tracking can
// never block navigation. Requires a signed-in non-anonymous user; the
// portal comes from the client, which is fine for analytics (a user can
// only mislabel their own activity).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const portal = PORTALS.find((p) => p === body?.portal)
    if (!portal) return NextResponse.json({ recorded: false })
    const eventType = body?.eventType === 'LINK_CLICK' ? 'LINK_CLICK' : 'PAGE_VIEW'
    const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
    const href = typeof body?.href === 'string' ? body.href.slice(0, 500) : null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.is_anonymous) return NextResponse.json({ recorded: false })

    await prisma.portalPageActivityEvent.create({
      data: {
        portal,
        userId: user.id,
        eventType,
        path: eventType === 'PAGE_VIEW' ? path : null,
        href: eventType === 'LINK_CLICK' ? href : null,
      },
    })
    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record portal activity event:', error)
    return NextResponse.json({ recorded: false })
  }
}
