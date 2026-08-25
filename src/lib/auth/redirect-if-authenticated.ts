import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PortalKey } from '@/lib/supabase/portal'

// Every /*/login page is a static form with no session check, so a visitor
// who is already logged in (session cookie still valid — see
// src/lib/supabase/middleware.ts's silent refresh) sees the login form
// again instead of going straight to their dashboard. Call this at the top
// of each login page's Server Component; if a session exists, it redirects
// before the form ever renders. `destination` should match that portal's
// LoginForm `defaultNext`, since that's where a fresh login would land
// anyway. Safe to point every portal's login page at its own "home" even
// for a user who turns out to belong to a different portal — the actual
// dashboard/home routes already re-route via redirectIfNotCandidate (see
// src/lib/auth/redirect-non-candidate.ts) or the equivalent per-portal check.
//
// Excludes anonymous users deliberately: every onboarding candidate carries
// an anonymous Supabase session (see CreateAccountForm's sendConfirmation)
// until they finish registration, so a candidate who bails to /auth/login
// mid-onboarding — e.g. to log into an existing account instead — has a
// real `user` here even though they never actually logged in. Redirecting
// them straight past the login form (into `destination`, which then usually
// bounces them right back into onboarding) is exactly the "clicking Log in
// takes me to a redirect instead of the login screen" bug this guards
// against; only a real, non-anonymous session should skip the form.
export async function redirectIfAuthenticated(destination: string, portal?: PortalKey) {
  const supabase = await createClient(portal)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && !user.is_anonymous) {
    redirect(destination)
  }
}
