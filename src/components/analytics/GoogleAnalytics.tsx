'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
// Unset in any environment where GA shouldn't load — component renders nothing.

// Crawl concerns (robots.ts) and analytics concerns (this list) answer
// different questions — deliberately not sharing one list. GA4 must never
// fire on any authenticated workspace route. /talent is now also a PUBLIC
// marketing page (see PORTAL_APP_SUBROUTES in lib/supabase/portal.ts) —
// its bare path is deliberately absent here so pageviews on the marketing
// page itself still get tracked; only the real app subroutes are excluded.
const EXCLUDED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/talent/dashboard',
  '/talent/roles',
  '/talent/candidates',
  '/talent/messages',
  '/talent/saved',
  '/talent/analytics',
  '/talent/job-board',
  '/talent/team',
  '/talent/settings',
  '/support',
  '/auth',
  '/api',
]

// gtag.js (177 KB) is fetched on the visitor's first interaction, or after this long if there is none.
const LOAD_AFTER_MS = 4000
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function loadGtagOnce(id: string) {
  if (document.querySelector('script[data-ga-loader]')) return
  const el = document.createElement('script')
  el.async = true
  el.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  el.setAttribute('data-ga-loader', '')
  document.head.appendChild(el)
}

const AI_REFERRER_DOMAINS = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'copilot.microsoft.com']

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const excluded = EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    if (!GA_ID || excluded || typeof window.gtag !== 'function') return

    const referrer = document.referrer
    const aiMatch = AI_REFERRER_DOMAINS.find((domain) => referrer.includes(domain))

    window.gtag('event', 'page_view', {
      traffic_source_type: aiMatch ? 'ai_referral' : undefined,
    })
  }, [pathname, excluded])

  useEffect(() => {
    if (!GA_ID || excluded) return
    const id = GA_ID
    const timer = window.setTimeout(load, LOAD_AFTER_MS)
    function load() {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
      loadGtagOnce(id)
    }
    INTERACTION_EVENTS.forEach((name) => window.addEventListener(name, load, { passive: true, once: true }))
    return () => {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
    }
  }, [excluded])

  if (!GA_ID || excluded) return null

  return (
    <>
      {/* The 177 KB gtag.js is added by the effect above on the first interaction (or after 4 s), not at the start or on
          window load: it would compete with the page's own CSS and fonts on a slow phone. Events are not lost: the init
          script below defines gtag() and queues every call on window.dataLayer straight away, and gtag.js replays the
          queue when it arrives (the same thing Google's own snippet relies on). */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
