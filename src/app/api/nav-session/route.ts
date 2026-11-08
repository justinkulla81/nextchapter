import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allowedNavOrigin } from '@/lib/nav/nav-origin'
import { prisma } from '@/lib/prisma'

// Called by the main site's header, from the browser, on candidate.<site>, where the member's login cookie lives (the main site never sees it).
// Answers whether the visitor is signed in there now, so a header does not greet a member whose login has expired. A flag and a first name, no
// credential. Readable only from the site's own origins, with cookies.
export const dynamic = 'force-dynamic'

function headers(request: Request): Record<string, string> {
  const allow = allowedNavOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL)
  return {
    'Cache-Control': 'private, no-store',
    Vary: 'Origin',
    ...(allow ? { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' } : {}),
  }
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: headers(request) })
}

export async function GET(request: Request) {
  const h = headers(request)
  // Not from one of our pages: no answer, so the endpoint is no way to probe a browser from another site.
  if (!h['Access-Control-Allow-Origin'] && request.headers.get('origin')) return NextResponse.json({ signedIn: false, firstName: null }, { status: 403, headers: h })
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.is_anonymous) return NextResponse.json({ signedIn: false, firstName: null }, { headers: h })
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { firstName: true } }).catch(() => null)
    return NextResponse.json({ signedIn: true, firstName: profile?.firstName?.trim() || null }, { headers: h })
  } catch {
    // Could not tell: say so (503), and the header keeps what it had.
    return NextResponse.json({ signedIn: null, firstName: null }, { status: 503, headers: h })
  }
}
