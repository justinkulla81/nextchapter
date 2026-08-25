import { createBrowserClient } from '@supabase/ssr'
import { PORTAL_COOKIE_NAMES, type PortalKey } from './portal'

// Omitting `portal` keeps today's exact behavior (the default/candidate
// cookie) — passing one scopes the session to that portal's own cookie name
// so it never shares auth state with any other portal in the same browser.
export function createClient(portal?: PortalKey) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    portal ? { cookieOptions: { name: PORTAL_COOKIE_NAMES[portal] } } : undefined
  )
}
