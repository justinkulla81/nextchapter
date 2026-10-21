'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires pivot_paths_viewed once when a server-rendered pivot list (teaser) mounts. */
export function PivotPathsViewedBeacon({ properties }: { properties: Record<string, unknown> }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    posthog.capture('pivot_paths_viewed', properties)
  }, [properties])
  return null
}
