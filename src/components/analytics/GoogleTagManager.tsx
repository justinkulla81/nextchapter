'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { EXCLUDED_PREFIXES } from './GoogleAnalytics'

// Google Tag Manager container (the Google Ads tag lives in it). Unset in any environment where it should not load:
// the component then renders nothing. Same rules as GoogleAnalytics: never on a signed-in workspace route, and the
// script is fetched on the visitor's first interaction (or after 4 s) so it does not compete with the page's CSS and fonts.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

const LOAD_AFTER_MS = 4000
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function loadGtmOnce(id: string) {
  if (document.querySelector('script[data-gtm-loader]')) return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  // The standard GTM bootstrap: tells the container when it started so its triggers fire in order.
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const el = document.createElement('script')
  el.async = true
  el.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`
  el.setAttribute('data-gtm-loader', '')
  document.head.appendChild(el)
}

export function GoogleTagManager() {
  const pathname = usePathname()
  const excluded = EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    if (!GTM_ID || excluded) return
    const id = GTM_ID
    const timer = window.setTimeout(load, LOAD_AFTER_MS)
    function load() {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
      loadGtmOnce(id)
    }
    INTERACTION_EVENTS.forEach((name) => window.addEventListener(name, load, { passive: true, once: true }))
    return () => {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
    }
  }, [excluded])

  return null
}
