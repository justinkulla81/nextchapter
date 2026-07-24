import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Every existing admin page does one `getUserById` call per row inside a
// `Promise.all` — fine at today's small scale, but N+1 against the Supabase
// Admin API for any page browsing potentially hundreds of candidates. This
// fetches every auth user once (paginated, capped) and returns a map to join
// against in memory instead.
const PER_PAGE = 1000
const MAX_PAGES = 5 // 5,000 users — well past this pre-seed platform's real scale; won't silently truncate below that

export interface AuthUserSummary {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
}

export async function listAllAuthUsers(): Promise<Map<string, AuthUserSummary>> {
  const admin = createAdminClient()
  const map = new Map<string, AuthUserSummary>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw error

    for (const user of data.users) {
      map.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      })
    }

    if (data.users.length < PER_PAGE) break
  }

  return map
}

export function getAuthEmail(users: Map<string, AuthUserSummary>, userId: string | null): string {
  if (!userId) return '— (token-only, no login)'
  return users.get(userId)?.email ?? 'unknown'
}
