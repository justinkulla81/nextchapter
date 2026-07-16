import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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
  // has no session at all yet (not even anonymous), and /onboarding/resume
  // is what lazily starts one on upload. Gating it here would bounce them to
  // a login page that implies a password is required, before they've done
  // anything. Per-page redirect logic (getCandidateProfileForUser) handles
  // routing a truly session-less visitor to /onboarding/resume instead.
  // /talent/signup is intentionally NOT protected — same reasoning as
  // /onboarding above: a first-time hiring-manager visitor has no session
  // yet, and the signup form is what creates one.
  const protectedPaths = ['/dashboard', '/talent']
  const isProtected =
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    !request.nextUrl.pathname.startsWith('/talent/signup')

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
