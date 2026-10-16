'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// In-app links built as /i/<slug>/... render the same page as the portal's
// public address (/highered or /workforce, a rewrite), so swap the address
// bar to the public one without reloading.
export function CanonicalOrgUrl({ slug, base }: { slug: string; base: string }) {
  const pathname = usePathname()
  useEffect(() => {
    const from = `/i/${slug}`
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      window.history.replaceState(window.history.state, '', `${base}${pathname.slice(from.length)}${window.location.search}${window.location.hash}`)
    }
  }, [pathname, slug, base])
  return null
}
