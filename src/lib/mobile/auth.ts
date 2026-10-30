import 'server-only'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// The app signs in with the existing Supabase auth and sends the access token as a bearer header. The token is checked with
// Supabase on every call (getUser), never decoded locally. Returns null for no token or a bad one.
export async function mobileUser(request: NextRequest): Promise<{ id: string; email: string | null } | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token.length > 4000) return null
  try {
    const { data } = await createAdminClient().auth.getUser(token)
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null
  } catch {
    return null
  }
}

export async function mobileUserId(request: NextRequest): Promise<string | null> {
  return (await mobileUser(request))?.id ?? null
}
