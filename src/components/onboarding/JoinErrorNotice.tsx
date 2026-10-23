'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

// What went wrong on the way back from Google, and what to do. The failure is
// recorded here (not on the server) because nobody is signed in yet to attribute
// it to.
export function JoinErrorNotice({ code, message }: { code: string; message: string }) {
  useEffect(() => {
    posthog.capture('onboarding_google_failed', { reason: code })
  }, [code])

  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </p>
  )
}
