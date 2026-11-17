'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

// One view event per part of Why hire me, with the strengths shape and how many proof marks the member has.
export function StrengthsViewed({ shape, peaks, part, marks }: { shape: string; peaks: string[]; part?: string; marks?: number }) {
  const sent = useRef<string | null>(null)
  useEffect(() => {
    const key = part ?? 'edge'
    if (sent.current === key) return
    sent.current = key
    posthog.capture('strengths_viewed', { shape, peaks, part: key, marks })
  }, [shape, peaks, part, marks])
  return null
}
