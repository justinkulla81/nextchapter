'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

// Pageviews are queued and sent once the (idle-loaded) PostHog client is ready — see
// ./client.ts. Nothing here imports posthog-js itself, so it stays out of the critical bundle.
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
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  )
}
