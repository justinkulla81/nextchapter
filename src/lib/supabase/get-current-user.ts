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
