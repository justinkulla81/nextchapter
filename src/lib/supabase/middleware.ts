import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PORTAL_COOKIE_NAMES, portalForPath, PORTAL_APP_SUBROUTES } from '@/lib/supabase/portal'

// Plain `pathname.startsWith(prefix)` treats '/employer' as a match for
// '/employers' too — a real production bug this fixed: the public
// /employers marketing page was matching the protected /employer
// (outplacement portal) prefix purely because "employers" starts with
// "employer" as a string, redirecting every anonymous visitor straight to
// /employer/login instead of ever showing the page. Require a path
// boundary (exact match or the next character is '/') so a prefix can
// never accidentally swallow an unrelated sibling route.
function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

// Whether ANY Supabase session cookie is present for the relevant portal —
// checked with startsWith (not equality) because @supabase/ssr chunks a
// large token across suffixed cookies ('sb-admin-auth-token.0', '.1', ...)
// when it doesn't fit in one cookie. For the default/candidate portal
// (cookieBaseName undefined — no explicit cookieOptions.name is passed to
// createServerClient there), fall back to Supabase's own generic naming
// convention ('sb-<project-ref>-auth-token') rather than hardcoding the
// project ref.
function hasSupabaseSessionCookie(request: NextRequest, cookieBaseName?: string): boolean {
  return request.cookies
    .getAll()
    .some((c) => (cookieBaseName ? c.name.startsWith(cookieBaseName) : c.name.startsWith('sb-') && c.name.includes('auth-token')))
}

export async function updateSession(request: NextRequest) {
  // Forward the pathname as a REQUEST header (not a response header) so
  // headers().get('x-pathname') in Server Component layouts (e.g.
  // src/app/dashboard/layout.tsx) can actually see it — setting a header on
  // the response only reaches the browser, not Next.js's internal request
  // processing. request.headers is mutated in place, so this survives the
  // supabaseResponse reassignment in the setAll cookie-refresh branch below.
  request.headers.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({ request })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase env vars are not set — skipping session refresh.')
    return supabaseResponse
  }

  // Each non-candidate portal gets its own session cookie (see
  // src/lib/supabase/portal.ts) — refreshing the RIGHT one per request
  // matters, not just cosmetic: this is the only place any portal's access
  // token gets silently refreshed, so a portal whose cookie never gets
  // refreshed here would hard-expire on its Supabase access-token TTL with
  // no recovery path.
  const portal = portalForPath(request.nextUrl.pathname)
  const portalCookieName = portal ? PORTAL_COOKIE_NAMES[portal] : undefined

  // supabase.auth.getUser() is a real network round-trip to Supabase's auth
  // server — a real, measured site-wide latency source (this call alone was
  // ~1.6s of a ~1.7s page load in profiling) when it runs unconditionally on
  // every single request, including the vast majority of traffic that's a
  // session-less visitor on a public page with nothing to refresh at all.
  // Skipping it when no relevant session cookie is present is safe: `user`
  // stays exactly what it already is for a session-less visitor (there is
  // none), so the isProtected redirect logic below is unaffected — an
  // anonymous visitor hitting a protected path still redirects correctly,
  // just without the wasted round trip.
  let user = null
  if (hasSupabaseSessionCookie(request, portalCookieName)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: portalCookieName ? { name: portalCookieName } : undefined,
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refreshes the session token if expired. Required so Server Components
    // reading cookies always see a valid session.
    const result = await supabase.auth.getUser()
    user = result.data.user
  }

  // /onboarding is intentionally NOT protected here — a first-time visitor
  // has no session at all yet (not even anonymous), and /onboarding/desire
  // (the first step) is what lazily starts one on submit. Gating it here
  // would bounce them to a login page that implies a password is required,
  // before they've done anything. Per-page redirect logic
  // (getCandidateProfileForUser) handles routing a truly session-less
  // visitor to /onboarding/desire instead.
  // /talent/signup is intentionally NOT protected — same reasoning as
  // /onboarding above: a first-time hiring-manager visitor has no session
  // yet, and the signup form is what creates one.
  // /talent/seats/accept is intentionally NOT protected — an invited
  // teammate with no NextChapter account yet must be able to view the
  // invite and create one; the page itself handles the logged-in-vs-not
  // branching once loaded.
  // /talent/login and /talent/forgot-password are public auth pages by
  // definition — a signed-out visitor (including Googlebot) must be able
  // to load them without being redirected to /auth/login first. Missing
  // these two caused a real "Page with redirect" indexing issue: Google
  // discovered /talent/login via the public /for-organizations page and
  // got redirected every time it crawled.
  // /noexperience/employers is NEN's own portal — an unauthenticated hit must
  // land on NEN's own login, not the main site's /auth/login, or it stops
  // feeling like its own product the moment someone gets bounced.
  // /noexperience/employers/contests/entry is a public, no-account entry link
  // (see CrucibleContestEntry.token) — a candidate with no NextChapter
  // account must be able to open and submit it.
  // /eqoveriq/contributors is EQoverIQ's own portal — same "must land on
  // its own login, not the main site's" reasoning as NEN's employer portal.
  // Recruiter/coach/talent/employer/admin are gated here too, now that each
  // has its own real, refreshable session (see portalForPath above) — this
  // is on top of, not instead of, each portal's own page-level
  // getCurrentX()/requireAdmin() check, which stays in place as a backstop.
  const protectedPaths = [
    '/dashboard',
    // /talent is a PUBLIC marketing page now — only its real
    // app subroutes (one level deeper, see PORTAL_APP_SUBROUTES) are
    // protected. Listing the bare portal path here would prefix-match the
    // marketing page too and redirect every anonymous visitor straight to
    // login before they ever see it (the exact bug this fixed for /hiring).
    ...PORTAL_APP_SUBROUTES.talent!,
    '/noexperience/employers',
    '/eqoveriq/contributors',
    '/recruiters',
    '/support/coach',
    '/employer',
    '/support/admin',
  ]
  const publicExceptions = [
    '/talent/signup',
    '/talent/seats/accept',
    '/talent/login',
    '/talent/forgot-password',
    '/noexperience/employers/signup',
    '/noexperience/employers/login',
    '/noexperience/employers/forgot-password',
    '/noexperience/employers/contests/entry',
    '/eqoveriq/contributors/signup',
    '/eqoveriq/contributors/login',
    '/eqoveriq/contributors/forgot-password',
    '/recruiters/signup',
    '/recruiters/login',
    '/recruiters/forgot-password',
    '/support/coach/signup',
    '/support/coach/login',
    '/support/coach/forgot-password',
    '/employer/login',
    '/employer/signup',
    '/employer/forgot-password',
    '/employer/seats/accept',
    '/employer/invite/accept',
    '/support/admin/login',
    '/support/admin/forgot-password',
  ]
  const isProtected =
    protectedPaths.some((path) => pathStartsWith(request.nextUrl.pathname, path)) &&
    !publicExceptions.some((path) => pathStartsWith(request.nextUrl.pathname, path))

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    const portalLoginPath = Object.entries({
      '/noexperience/employers': '/noexperience/employers/login',
      '/eqoveriq/contributors': '/eqoveriq/contributors/login',
      ...Object.fromEntries(PORTAL_APP_SUBROUTES.talent!.map((p) => [p, '/talent/login'])),
      '/recruiters': '/recruiters/login',
      '/support/coach': '/support/coach/login',
      '/employer': '/employer/login',
      '/support/admin': '/support/admin/login',
    }).find(([prefix]) => pathStartsWith(request.nextUrl.pathname, prefix))?.[1]
    redirectUrl.pathname = portalLoginPath ?? '/auth/login'
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
