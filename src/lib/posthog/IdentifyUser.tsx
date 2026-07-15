'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

export function IdentifyUser({ candidateId, email }: { candidateId: string; email: string | null }) {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return
    posthog.identify(candidateId, email ? { email } : undefined)
  }, [posthog, candidateId, email])

  return null
}
