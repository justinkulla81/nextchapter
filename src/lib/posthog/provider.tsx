'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

let initialized = false

// Deferred to run after mount (not at module scope) so PostHog's own script
// injections into <head> (config/surveys/etc.) never race React's initial
// hydration pass — doing this at module scope caused a spurious "hydration
// mismatch" console error against unrelated server-rendered <script> tags
// (e.g. StructuredData's JSON-LD) on some pages.
function ensurePostHogInitialized() {
  if (initialized || typeof window === 'undefined' || !KEY) return
  initialized = true
  posthog.init(KEY, {
    api_host: '/ingest',
    ui_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    // Resume text, job descriptions, and interview answers pass through this
    // app — recording is opt-in only, turned on deliberately later if wanted,
    // never a silent default for a site handling this kind of content.
    disable_session_recording: true,
  })
}

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!KEY) return
    ensurePostHogInitialized()
    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    posthog.capture('$pageview', { $current_url: window.location.origin + url })
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!KEY) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  )
}
