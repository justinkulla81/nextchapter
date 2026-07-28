import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const ADMIN_HOST = 'admin.launchyournextchapter.com'
const MAIN_HOSTS = new Set(['launchyournextchapter.com', 'www.launchyournextchapter.com'])

// Isolates the admin portal on its own subdomain so its session cookie never
// shares a cookie jar with the candidate-facing site. Neither Supabase
// adapter in this app sets an explicit cookie Domain, so cookies already
// default to host-only scoping — serving admin from a distinct hostname is
// enough for real isolation on its own, no cookie changes needed.
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // A stale bookmark or link to /support/admin/** on the main domain now
  // bounces to the isolated subdomain instead of rendering there directly.
  if (MAIN_HOSTS.has(host) && pathname.startsWith('/support/admin')) {
    const url = request.nextUrl.clone()
    url.protocol = 'https'
    url.hostname = ADMIN_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  // The admin subdomain's own root has nothing to render — send it to the
  // actual admin homepage.
  if (host === ADMIN_HOST && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/support/admin'
    return NextResponse.redirect(url, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
