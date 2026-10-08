'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export type PortalKind = 'COACH' | 'RECRUITER' | 'EMPLOYER' | 'TALENT' | 'CRUCIBLE_EMPLOYER' | 'EQOVERIQ_CONTRIBUTOR'

function track(portal: PortalKind, eventType: 'PAGE_VIEW' | 'LINK_CLICK', payload: { path?: string; href?: string }) {
  const body = JSON.stringify({ portal, eventType, ...payload })
  const url = '/api/track/portal-activity'

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    return
  }
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}

function PageViewTracker({ portal }: { portal: PortalKind }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const path = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    track(portal, 'PAGE_VIEW', { path })
  }, [portal, pathname, searchParams])

  return null
}

// Partner-portal counterpart to DashboardActivityTracker (candidates).
// Mount once in each portal's authenticated layout.
export function PortalActivityTracker({ portal }: { portal: PortalKind }) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const href = target?.closest('a')?.getAttribute('href')
      if (!href) return
      track(portal, 'LINK_CLICK', { href })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [portal])

  return (
    <Suspense fallback={null}>
      <PageViewTracker portal={portal} />
    </Suspense>
  )
}
