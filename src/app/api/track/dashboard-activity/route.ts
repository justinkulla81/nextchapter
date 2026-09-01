import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// Hit by the client-side DashboardActivityTracker beacon — never blocks
// navigation (fire-and-forget from the browser), so failures here are
// swallowed rather than surfaced anywhere. Read-only profile lookup (never
// getOrCreateCandidateProfile) — a stray beacon call from an edge case
// (session expiring mid-request) should never create a profile row just
// from a tracking ping.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eventType = body?.eventType === 'LINK_CLICK' ? 'LINK_CLICK' : 'PAGE_VIEW'
    const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
    const href = typeof body?.href === 'string' ? body.href.slice(0, 500) : null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.is_anonymous) return NextResponse.json({ recorded: false })

    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!profile) return NextResponse.json({ recorded: false })

    await prisma.candidatePageActivityEvent.create({
      data: {
        candidateId: profile.id,
        eventType,
        path: eventType === 'PAGE_VIEW' ? path : null,
        href: eventType === 'LINK_CLICK' ? href : null,
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record dashboard activity event:', error)
    return NextResponse.json({ recorded: false })
  }
}
