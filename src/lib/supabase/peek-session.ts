import 'server-only'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { stringFromBase64URL } from '@supabase/ssr'
import { PORTAL_COOKIE_NAMES, type PortalKey } from '@/lib/supabase/portal'

// Who is signed in to a portal, WITHOUT ever refreshing or writing its session.
//
// For pages the proxy does not refresh that portal's cookie on (today: /employer-home, which maps to no portal). The
// normal server client would, on an expired access token, spend the refresh token and then fail to save the new one
// (a Server Component cannot set cookies), which can log the person out everywhere. This reads the cookie, checks the
// access token has not expired, and asks Supabase who it belongs to with that token alone. An expired or missing
// session simply reads as "not signed in here"; the portal's own pages, which the proxy does refresh, are unaffected.
// It never calls setAll, never reads a refresh token, and changes no cookie.

export interface PeekedUser {
  id: string
  email: string | null
}

type CookieLike = { name: string; value: string }

/** The access token and its expiry from a Supabase session cookie (single, or chunked as name.0, name.1, ...). Pure. */
export function readSessionCookie(all: CookieLike[], baseName: string): { accessToken: string; expiresAt: number } | null {
  const parts = all
    .filter((c) => c.name === baseName || (c.name.startsWith(`${baseName}.`) && /^\d+$/.test(c.name.slice(baseName.length + 1))))
    .map((c) => ({ n: c.name === baseName ? -1 : Number(c.name.slice(baseName.length + 1)), value: c.value }))
    .sort((a, b) => a.n - b.n)
  if (!parts.length) return null
  let raw = parts.map((p) => p.value).join('')
  try {
    if (raw.startsWith('base64-')) raw = stringFromBase64URL(raw.slice('base64-'.length))
    const session = JSON.parse(raw) as { access_token?: unknown; expires_at?: unknown }
    if (typeof session.access_token !== 'string' || typeof session.expires_at !== 'number') return null
    return { accessToken: session.access_token, expiresAt: session.expires_at }
  } catch {
    return null
  }
}

/** True when the token is still good for at least `marginSeconds` more. */
export function tokenIsLive(expiresAtSeconds: number, nowMs = Date.now(), marginSeconds = 15): boolean {
  return expiresAtSeconds * 1000 > nowMs + marginSeconds * 1000
}

export async function peekPortalUser(portal: PortalKey): Promise<PeekedUser | null> {
  const store = await cookies()
  const session = readSessionCookie(store.getAll(), PORTAL_COOKIE_NAMES[portal])
  if (!session || !tokenIsLive(session.expiresAt)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const client = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const { data, error } = await client.auth.getUser(session.accessToken)
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch {
    return null
  }
}
