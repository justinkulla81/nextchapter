'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

const PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID
// Unset in any environment where the tag shouldn't load — component renders nothing.

// LinkedIn's terms bar the Insight Tag from pages with sensitive data, so this
// is an allowlist of public marketing and SEO pages, not the exclusion list
// GoogleAnalytics uses. Anything not listed (every signed-in workspace, forms
// that collect personal details, new top-level routes) stays untagged until it
// is added here on purpose.
const EXACT_PATHS = ['/', '/for-managers']
const PUBLIC_PREFIXES = [
  '/about',
  '/pricing',
  '/how-it-works',
  '/for-coaches',
  '/for-organizations',
  '/employers',
  '/government-workforce',
  '/higher-education',
  '/economic-development',
  '/nonprofits',
  '/associations',
  '/outplacement',
  '/rapid-response',
  '/workforce-boards',
  '/job-centers',
  '/search-firms',
  '/for-rapid-response',
  '/demo/workforce',
  '/ai-training',
  '/ai-skills',
  '/contact',
  '/faq',
  '/layoffs',
  '/insights',
  '/reports',
  '/vs',
  '/why-stuck',
  '/places',
  '/security',
]

export function isLinkedInTagPath(pathname: string): boolean {
  return (
    EXACT_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  )
}

// insight.min.js is fetched on the visitor's first interaction, or after this long if there is none.
const LOAD_AFTER_MS = 4000
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function loadInsightOnce() {
  if (document.querySelector('script[data-li-loader]')) return
  const el = document.createElement('script')
  el.async = true
  el.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js'
  el.setAttribute('data-li-loader', '')
  document.head.appendChild(el)
}

export function LinkedInInsightTag() {
  const pathname = usePathname()
  const allowed = !!PARTNER_ID && isLinkedInTagPath(pathname)

  useEffect(() => {
    if (!allowed) return
    const timer = window.setTimeout(load, LOAD_AFTER_MS)
    function load() {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
      loadInsightOnce()
    }
    INTERACTION_EVENTS.forEach((name) => window.addEventListener(name, load, { passive: true, once: true }))
    return () => {
      window.clearTimeout(timer)
      INTERACTION_EVENTS.forEach((name) => window.removeEventListener(name, load))
    }
  }, [allowed])

  if (!allowed) return null

  // Same shape as LinkedIn's own snippet: the partner id is registered and lintrk() queues calls straight away,
  // and insight.min.js replays the queue when the effect above loads it.
  return (
    <Script id="linkedin-insight-init" strategy="afterInteractive">
      {`
        window._linkedin_partner_id = '${PARTNER_ID}';
        window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
        window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
        if (!window.lintrk) {
          window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
          window.lintrk.q = [];
        }
      `}
    </Script>
  )
}
