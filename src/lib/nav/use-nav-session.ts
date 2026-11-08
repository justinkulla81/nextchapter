'use client'

import { useEffect, useState } from 'react'
import { getNavSession, type NavSession } from '@/lib/nav/nav-session-action'
import { forgetMemberCookies } from '@/lib/auth/forget-member'

// Public pages are cached for everyone, so who is signed in is asked for in the browser. The header, the next-step box and the
// footer all ask on the same page; they share one request. A failed request counts as signed out.
let pending: Promise<NavSession> | null = null

/**
 * A browser the member marker calls signed in may hold a login that has expired. Ask the candidate host, where the login cookie lives. Only a
 * plain "not signed in" answer changes anything (and then the marker comes off, so the site stops treating the browser as a member's);
 * a failed, blocked or slow request keeps the header as it was.
 */
async function verifyLogin(s: NavSession): Promise<NavSession> {
  if (!s.signedIn || !s.verifyAt) return s
  try {
    const res = await fetch(s.verifyAt, { credentials: 'include', signal: AbortSignal.timeout(4000) })
    if (!res.ok) return s
    const body = (await res.json()) as { signedIn?: boolean | null; firstName?: string | null }
    if (body.signedIn === false) {
      void forgetMemberCookies().catch(() => {})
      return { signedIn: false, firstName: null }
    }
    return body.signedIn === true ? { signedIn: true, firstName: body.firstName ?? s.firstName } : s
  } catch {
    return s
  }
}

function loadSession(): Promise<NavSession> {
  if (!pending) {
    pending = getNavSession().then(verifyLogin).catch(() => ({ signedIn: false, firstName: null }))
    // Forget it after a moment so a sign-in in another tab, or a client-side move to another page, is seen.
    setTimeout(() => { pending = null }, 30_000)
  }
  return pending
}

/** null while unknown (the page renders its signed-out version), then who the visitor is. */
export function useNavSession(): NavSession | null {
  const [session, setSession] = useState<NavSession | null>(null)
  useEffect(() => {
    let live = true
    loadSession().then((s) => live && setSession(s))
    return () => { live = false }
  }, [])
  return session
}
