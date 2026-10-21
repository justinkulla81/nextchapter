'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

export function StrengthsViewed({ shape, peaks }: { shape: string; peaks: string[] }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    posthog.capture('strengths_viewed', { shape, peaks })
  }, [shape, peaks])
  return null
}
