import type { PortalKey } from './portal'

// The browser Supabase client (supabase-js + GoTrue, ~57 KB gzipped) is only needed once a
// visitor actually submits an auth form or lands on a callback. Importing it statically put
// it in the initial bundle of every login / signup page; this loads it on first use instead.
// Call sites are all inside event handlers / effects, so awaiting it is invisible to users.
export async function createClientLazy(portal?: PortalKey) {
  const { createClient } = await import('./client')
  return createClient(portal)
}
