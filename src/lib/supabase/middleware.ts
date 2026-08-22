import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  const protectedPaths = ['/dashboard', '/talent', '/noexperience/employers', '/eqoveriq/contributors']
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
  ]
  const isProtected =
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    !publicExceptions.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    const portalLoginPath = Object.entries({
      '/noexperience/employers': '/noexperience/employers/login',
      '/eqoveriq/contributors': '/eqoveriq/contributors/login',
    }).find(([prefix]) => request.nextUrl.pathname.startsWith(prefix))?.[1]
    redirectUrl.pathname = portalLoginPath ?? '/auth/login'
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
