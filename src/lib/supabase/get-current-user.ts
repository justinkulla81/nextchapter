import { cache } from 'react'
import { createClient } from './server'
import type { PortalKey } from './portal'
import { aalOf } from '@/lib/admin/mfa'

// Memoized per-request (React's cache(), not cross-request) — layout.tsx and
// the page it wraps each independently need "who's logged in", and without
// this they'd each trigger their own network round trip to Supabase's Auth
// server via getUser() for the exact same request. This doesn't weaken the
// security guarantee (getUser() still revalidates the token against
// Supabase, exactly once per request) — it just avoids paying for that
// round trip twice when nothing about the answer could have changed between
// two reads within the same render pass.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

// Who the session belongs to, from the verified JWT claims rather than a round trip to Supabase's Auth server
// (getCurrentUser above). The proxy (src/lib/supabase/middleware.ts) has already called getUser() for this request, so
// the token is fresh; getClaims() checks its signature locally when the project signs with asymmetric keys, and
// falls back to the same Auth call when it does not, so this is never less safe than getUser, only sometimes faster.
// Carries only what onboarding's pages need: no identities, so a caller that needs those (the registration sync for a
// member who is no longer anonymous) still uses getCurrentUser. Falls back to getCurrentUser if the claims cannot be
// read, so an unreadable token never looks like "no session".
export interface SessionIdentity {
  id: string
  email: string | null
  isAnonymous: boolean
}

export const getSessionIdentity = cache(async (): Promise<SessionIdentity | null> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (!error && claims && typeof claims.sub === 'string') {
      return {
        id: claims.sub,
        email: typeof claims.email === 'string' && claims.email !== '' ? claims.email : null,
        isAnonymous: claims.is_anonymous === true,
      }
    }
  } catch {
    // Fall through to the full lookup.
  }
  const user = await getCurrentUser()
  return user ? { id: user.id, email: user.email ?? null, isAnonymous: user.is_anonymous === true } : null
})

// The college/workforce org portal's own session (staff, member companies,
// NextChapter admins), separate from the candidate one.
export const getOrgUser = cache(async () => {
  const supabase = await createClient('org')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

// The assurance level of a portal's session (aal2 = signed in with a second
// factor), read from its verified JWT claims. Null when signed out.
export const getSessionAal = cache(async (portal?: PortalKey) => {
  const supabase = await createClient(portal)
  const { data } = await supabase.auth.getClaims()
  return aalOf(data?.claims)
})
