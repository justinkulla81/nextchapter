import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { PORTAL_COOKIE_NAMES, type PortalKey } from './portal'

// Omitting `portal` keeps today's exact behavior (the default/candidate
// cookie) — passing one scopes the session to that portal's own cookie name
// so it never shares auth state with any other portal in the same browser.
export async function createClient(portal?: PortalKey) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: portal ? { name: PORTAL_COOKIE_NAMES[portal] } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore because
            // the middleware refreshes the session on every request.
          }
        },
      },
    }
  )
}
