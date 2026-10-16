import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { PROTECTED_APP_PATH_PREFIXES, pathStartsWith } from '@/lib/supabase/portal'
import { MAIN_SITE_SEGMENTS, ORG_SUBDOMAINS_ON, mainOrigin, orgKindForHost, orgOrigin } from '@/lib/org-hosts'

export const ADMIN_HOST = 'admin.launchyournextchapter.com'
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

  if (ORG_SUBDOMAINS_ON) {
    const orgRoute = routeOrgHosts(request, host, pathname)
    if (orgRoute) return orgRoute
  }

  return updateSession(request)
}

// College and workforce portals on their own hosts (src/lib/org-hosts.ts).
function routeOrgHosts(request: NextRequest, host: string, pathname: string): Promise<NextResponse> | NextResponse | null {
  const kind = orgKindForHost(host)
  const search = request.nextUrl.search

  if (!kind) {
    // Main site: the old portal addresses move to their own host.
    const m = pathname.match(/^\/(workforce|highered)(\/.*)?$/)
    if (m) return NextResponse.redirect(`${orgOrigin(m[1] as 'workforce' | 'highered')}${m[2] ?? '/'}${search}`, 308)
    if (pathname === '/demo/workforce') return NextResponse.redirect(`${orgOrigin('workforce')}/demo${search}`, 308)
    return null // /i/<slug>/... moves in its layout, which knows the org's kind
  }

  // On a portal host.
  if (pathname === '/') return NextResponse.redirect(new URL('/login', request.url), 307)
  const passthrough = /^\/(_next|api|auth|ingest|i)(\/|$)/.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)
  if (passthrough) return updateSession(request, { portal: 'org' })
  const rewrite = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    return updateSession(request, { portal: 'org', rewriteTo: url })
  }
  // Main-site app pages (the dashboard, other portals) belong on the main host.
  if (['/onboarding', ...PROTECTED_APP_PATH_PREFIXES].some((p) => pathStartsWith(pathname, p))) return NextResponse.redirect(`${mainOrigin()}${pathname}${search}`, 307)
  if (pathname === '/login') return rewrite('/i/login')
  if (pathname === '/demo' && kind === 'workforce') return rewrite('/demo/workforce')
  // /<slug>/<segment>: job-seeker pages (join, sign-up, unsubscribe) live on
  // the main site; everything else is the portal app.
  const segment = pathname.split('/')[2]
  if (segment && MAIN_SITE_SEGMENTS.has(segment)) return NextResponse.redirect(`${mainOrigin()}/i${pathname}${search}`, 308)
  return rewrite(`/i${pathname}`)
}

export const config = {
  matcher: [
    // Static assets and public text/data files never need a session refresh
    // (sitemap.xml, robots.txt, llms.txt, ads/verification .txt, feed.xml,
    // guide PDFs, fonts). None of them sit behind auth.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|xml|txt|json|woff2)$).*)',
  ],
}
