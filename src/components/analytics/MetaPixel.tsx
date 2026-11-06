'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { isLinkedInTagPath } from '@/components/analytics/LinkedInInsightTag'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
// Unset in any environment where the pixel shouldn't load: the component renders nothing.

// Same public-marketing allowlist as the LinkedIn Insight Tag: no signed-in workspace and no form
// that collects personal details is ever tagged. A new page is untagged until it is added there.
const LOAD_AFTER_MS = 4000
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { q?: unknown[]; loaded?: boolean }
  }
}

function loadPixelOnce() {
  if (document.querySelector('script[data-meta-loader]')) return
  const el = document.createElement('script')
  el.async = true
  el.src = 'https://connect.facebook.net/en_US/fbevents.js'
  el.setAttribute('data-meta-loader', '')
  document.head.appendChild(el)
}

// Fire a Meta standard event (Lead, CompleteRegistration, ...). A no-op when the pixel is not loaded.
export function trackMetaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return
  window.fbq('track', name, params)
}

export function MetaPixel() {
  const pathname = usePathname()
  const allowed = !!PIXEL_ID && isLinkedInTagPath(pathname)

  // fbevents.js is fetched on the first interaction, or after a delay, so it stays off the critical path.
  useEffect(() => {
    if (!allowed) return
    const timer = window.setTimeout(load, LOAD_AFTER_MS)
    function load() {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
      loadPixelOnce()
    }
    INTERACTION_EVENTS.forEach((name) => window.addEventListener(name, load, { passive: true, once: true }))
    return () => {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
    }
  }, [allowed])

  // Single-page navigations: init sends the first PageView, every later route change sends its own.
  const lastPath = useRef<string | null>(null)
  useEffect(() => {
    if (!allowed) return
    if (lastPath.current !== null && lastPath.current !== pathname) window.fbq?.('track', 'PageView')
    lastPath.current = pathname
  }, [allowed, pathname])

  if (!allowed) return null

  return (
    <Script id="meta-pixel-init" strategy="afterInteractive">
      {`
        if (!window.fbq) {
          var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
          if (!window._fbq) window._fbq = n;
          n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
          window.fbq('init', '${PIXEL_ID}');
          window.fbq('track', 'PageView');
        }
      `}
    </Script>
  )
}
