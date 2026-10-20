'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { portalHostFor, portalHostOn, publicPathFor } from '@/lib/portal-hosts'

// On a portal's own host (recruiter., coach., employer.), in-app links
// written in app form (/recruiters/search, /talent/roles) render the same
// page as the public address (/search, /hiring/roles): show the public one.
export function PortalCanonicalUrl() {
  const pathname = usePathname()
  useEffect(() => {
    const h = portalHostFor(window.location.host)
    if (!h || !portalHostOn(h)) return
    const pub = publicPathFor(h, pathname)
    if (pub !== pathname) window.history.replaceState(window.history.state, '', `${pub}${window.location.search}${window.location.hash}`)
  }, [pathname])
  return null
}
