'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PROTECTED_APP_PATH_PREFIXES, pathStartsWith } from '@/lib/supabase/portal'

function track(eventType: 'PAGE_VIEW' | 'LINK_CLICK', payload: { path?: string; href?: string }) {
  const body = JSON.stringify({ eventType, ...payload })
  const url = '/api/track/homepage-visit'

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    return
  }
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}

function isPublicMarketingPath(pathname: string): boolean {
  return !PROTECTED_APP_PATH_PREFIXES.some((prefix) => pathStartsWith(pathname, prefix))
}

// Records a PAGE_VIEW on every route change and a LINK_CLICK for every
// outbound anchor click — the sitewide instrumentation for anonymous/public
// marketing traffic (as opposed to CandidateLoginEvent + the per-portal
// activity trackers, e.g. DashboardActivityTracker, which cover
// authenticated app usage). Despite the component's name (kept — see the
// HomepageVisitEvent model's own comment), this now mounts once in the
// root layout and covers every public page, not just "/" — gated by
// isPublicMarketingPath so it never double-tracks a page a portal's own
// tracker already covers. Needs usePathname/useSearchParams in its
// dependency array (not a mount-once effect) because the root layout
// persists across a client-side route change; same pattern
// DashboardActivityTracker's PageViewTracker already uses for the same
// reason.
function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isPublicMarketingPath(pathname)) return
    const path = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    track('PAGE_VIEW', { path })
  }, [pathname, searchParams])

  return null
}

export function HomepageVisitTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isPublicMarketingPath(window.location.pathname)) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a')
      const href = anchor?.getAttribute('href')
      if (!href) return
      track('LINK_CLICK', { href })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  )
}
