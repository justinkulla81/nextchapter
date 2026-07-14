import { cache } from 'react'
import { createClient } from './server'

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
