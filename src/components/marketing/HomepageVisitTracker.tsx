'use client'

import { useEffect } from 'react'

function track(eventType: 'PAGE_VIEW' | 'LINK_CLICK', href?: string) {
  const payload = JSON.stringify({ eventType, href })
  const url = '/api/track/homepage-visit'

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
    return
  }
  fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
    () => {}
  )
}

// Records a PAGE_VIEW on mount and a LINK_CLICK for every outbound anchor
// click on the page — the only sitewide instrumentation this app does for
// anonymous visitor traffic (as opposed to CandidateLoginEvent, which
// covers authenticated app usage). Renders nothing; mount once per page.
export function HomepageVisitTracker() {
  useEffect(() => {
    track('PAGE_VIEW')

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a')
      const href = anchor?.getAttribute('href')
      if (!href) return
      track('LINK_CLICK', href)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
