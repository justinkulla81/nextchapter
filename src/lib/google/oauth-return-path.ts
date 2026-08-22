import 'server-only'
import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'nc_google_oauth_return'
// The whole round trip (click -> Google's consent screen -> callback) is
// seconds, not minutes — generous headroom for someone who pauses on
// Google's screen without keeping the cookie alive indefinitely.
const MAX_AGE_SECONDS = 10 * 60

// Every return path used by this app's OAuth flows lives under /dashboard —
// restricting to that prefix (rather than accepting any string starting
// with '/') keeps an unvalidated query param from ever being able to send
// the post-connect redirect somewhere unexpected.
function isSafeReturnPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/dashboard')
}

interface StoredOAuthReturnState {
  nonce: string
  returnTo: string
}

// Called from every /api/auth/*/start route right before redirecting to
// Google. Google's own `state` param existed before this (random bytes)
// but was never actually validated anywhere in any of the three OAuth
// flows — dead CSRF protection. This both fixes that (the nonce returned
// here is what gets echoed back as `state`, and consumeOAuthReturnState
// below checks it matches) and carries the page to return to, which
// previously didn't exist at all — every callback hardcoded
// /dashboard/network regardless of where the candidate started.
export async function storeOAuthReturnState(requestReturnTo: string | null, fallback: string): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex')
  const returnTo = isSafeReturnPath(requestReturnTo) ? requestReturnTo : fallback
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify({ nonce, returnTo } satisfies StoredOAuthReturnState), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  })
  return nonce
}

// Called once at the top of every /api/auth/*/callback route. Falls back
// to `fallback` on any mismatch, missing, or expired cookie rather than
// failing the whole connection over a return-path nicety — a candidate
// whose round trip took too long still gets connected, just lands on the
// fallback page instead of where they started.
export async function consumeOAuthReturnState(returnedState: string | null, fallback: string): Promise<string> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  cookieStore.delete(COOKIE_NAME)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as StoredOAuthReturnState
    if (!returnedState || parsed.nonce !== returnedState) return fallback
    return isSafeReturnPath(parsed.returnTo) ? parsed.returnTo : fallback
  } catch {
    return fallback
  }
}
