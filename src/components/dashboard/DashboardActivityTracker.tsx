'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function track(eventType: 'PAGE_VIEW' | 'LINK_CLICK', payload: { path?: string; href?: string }) {
  const body = JSON.stringify({ eventType, ...payload })
  const url = '/api/track/dashboard-activity'

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    return
  }
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}

// Records a PAGE_VIEW on every route change (client-side navigation inside
// /dashboard/* doesn't trigger a full page load, so this needs its own
// usePathname effect rather than a mount-once beacon — same pattern as
// PostHog's own PageviewTracker in lib/posthog/provider.tsx) and a
// LINK_CLICK for every anchor click. The authenticated-app counterpart to
// HomepageVisitTracker; mount once in dashboard/layout.tsx.
function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const path = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    track('PAGE_VIEW', { path })
  }, [pathname, searchParams])

  return null
}

export function DashboardActivityTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
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
