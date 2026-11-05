'use client'

import { useEffect, useState } from 'react'
import { getNavSession, type NavSession } from '@/lib/nav/nav-session-action'

// Public pages are cached for everyone, so who is signed in is asked for in the browser. The header, the next-step box and the
// footer all ask on the same page; they share one request. A failed request counts as signed out.
let pending: Promise<NavSession> | null = null

function loadSession(): Promise<NavSession> {
  if (!pending) {
    pending = getNavSession().catch(() => ({ signedIn: false, firstName: null }))
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
