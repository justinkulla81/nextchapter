import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { PROTECTED_APP_PATH_PREFIXES, pathStartsWith } from '@/lib/supabase/portal'
import { APP_TOP_LEVEL, PORTAL_ROOT_PAGES } from '@/lib/app-top-level'
import { CANDIDATE_ORG_PAGES, HOSTS, LEGACY_EMPLOYER_HOST_PREFIX, appPathFor, cookieForAppPath, hostForAppPath, portalHostFor, portalHostOn, portalOrigin, publicPathFor, type PortalHost } from '@/lib/portal-hosts'
import { CUSTOMER_SUBDOMAINS_ON, customerSlugForHost } from '@/lib/organizations/front-door'
import { pausedPrefixes } from '@/lib/paused-pages'
import { HOME_AB_COOKIE, HOME_AB_MAX_AGE_SECONDS, HOME_AB_VARIANT_PATH, decideHomeVariant } from '@/lib/home-ab'
import { SERVER_COOKIES_SECURE } from '@/lib/supabase/cookie-options'
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

  // Emergency brake for the heavy public SEO pages (2026-10-26). Their big aggregate queries exhausted the database
  // connection pool and made /jobs time out. With PAUSE_HEAVY_PAGES=1 they answer 503 + Retry-After instantly and never
  // touch the database, so crawlers back off. Remove the env var and redeploy to switch them back on.
  if (MAIN_HOSTS.has(host) && pausedPrefixes().some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return new NextResponse('These pages are temporarily unavailable. Please try again later.', {
      status: 503,
      headers: { 'Retry-After': '86400', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

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

  // <slug>.<site> is a customer's front door (src/lib/organizations/front-door.ts).
  if (CUSTOMER_SUBDOMAINS_ON) {
    const customer = customerSlugForHost(host)
    if (customer && !/^\/(_next|api|auth|ingest)(\/|$)/.test(pathname) && !/\.[a-z0-9]+$/i.test(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = `/p/${customer}`
      return NextResponse.rewrite(url)
    }
  }

  if (ORG_SUBDOMAINS_ON) {
    const orgRoute = routeOrgHosts(request, host, pathname)
    if (orgRoute) return orgRoute
  }

  if (host.startsWith(LEGACY_EMPLOYER_HOST_PREFIX) && portalHostOn('employer')) {
    return NextResponse.redirect(`${portalOrigin('employer')}${pathname}${request.nextUrl.search}`, 308)
  }
  const portalHost = portalHostFor(host)
  if (portalHost && portalHostOn(portalHost)) return routePortalHost(request, portalHost, pathname)
  if (!portalHost && !orgKindForHost(host) && host !== ADMIN_HOST) {
    // Main site: a portal that has its own host now lives there.
    const moved = hostForAppPath(pathname)
    if (moved) return NextResponse.redirect(`${portalOrigin(moved)}${publicPathFor(moved, pathname)}${request.nextUrl.search}`, 307)
    // The employer portal's own addresses typed on the main site (no page there).
    if (portalHostOn('employer') && /^\/(hiring|growth|learning)(\/|$)/.test(pathname)) {
      return NextResponse.redirect(`${portalOrigin('employer')}${pathname}${request.nextUrl.search}`, 307)
    }
  }

  // (localhost too, so the test can be tried on a dev server; production never receives that host.)
  if ((MAIN_HOSTS.has(host) || /^localhost(:\d+)?$/.test(host)) && pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
    return serveHomepageTest(request)
  }

  return updateSession(request)
}

// The homepage test (src/lib/home-ab.ts): which cached homepage this visitor gets at "/". The variant is a rewrite, so the
// address and the cache stay as they are. Anyone who is not clearly a signed-out person's browser gets the control, untouched.
async function serveHomepageTest(request: NextRequest): Promise<NextResponse> {
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  const { variant, assign } = decideHomeVariant({
    cookie: request.cookies.get(HOME_AB_COOKIE)?.value,
    userAgent: request.headers.get('user-agent'),
    hasSession,
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
  })
  let response: NextResponse
  if (variant === 'b') {
    const url = request.nextUrl.clone()
    url.pathname = HOME_AB_VARIANT_PATH
    response = await updateSession(request, { rewriteTo: url })
  } else {
    response = await updateSession(request)
  }
  if (assign) {
    response.cookies.set(HOME_AB_COOKIE, variant, { path: '/', maxAge: HOME_AB_MAX_AGE_SECONDS, sameSite: 'lax', secure: SERVER_COOKIES_SECURE, httpOnly: true })
  }
  return response
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|xml|txt|json|woff2|zip)$).*)',
  ],
}

// Recruiter, coach, organization and candidate portals on their own hosts
// (src/lib/portal-hosts.ts).
function routePortalHost(request: NextRequest, h: PortalHost, pathname: string) {
  const search = request.nextUrl.search
  const toMain = () => NextResponse.redirect(`${mainOrigin()}${pathname}${search}`, 307)
  const rewrite = (to: string, portal: ReturnType<typeof cookieForAppPath>) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    return updateSession(request, { portal, rewriteTo: url })
  }
  const cfg = HOSTS[h]
  // Shared plumbing, and app paths already in their own form (in-app links).
  if (/^\/(_next|api|ingest)(\/|$)/.test(pathname) || /\.[a-z0-9]+$/i.test(pathname) || pathname.startsWith('/auth/callback')) {
    return updateSession(request, { portal: cfg.mounts[0]?.cookie })
  }
  if (h === 'candidate' && CANDIDATE_ORG_PAGES.test(pathname)) return updateSession(request)
  const asApp = cookieForAppPath(h, pathname)
  if (asApp !== undefined || cfg.mounts.some((m) => m.path === pathname || pathname.startsWith(`${m.path}/`))) return updateSession(request, { portal: asApp })
  if (pathname === '/') return rewrite(cfg.home, cfg.mounts[0]?.cookie)
  const top = pathname.split('/')[1] ?? ''
  const rootMounted = cfg.mounts.some((m) => m.at === '')
  // A main-site page opened here (a link to /pricing from a portal).
  if (rootMounted && !PORTAL_ROOT_PAGES[cfg.mounts[0].path]?.has(top) && APP_TOP_LEVEL.has(top)) return toMain()
  const app = appPathFor(h, pathname)
  if (!app) return toMain()
  if (app.path === pathname) return updateSession(request, { portal: app.cookie })
  return rewrite(app.path, app.cookie)
}
