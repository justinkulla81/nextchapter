import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
export async function redirectIfAuthenticated(destination: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(destination)
  }
}
