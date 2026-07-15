'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (typeof window !== 'undefined' && KEY) {
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
