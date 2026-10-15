'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

// Fires once when the results render, with what a real query would need.
export function PivotViewTracker(props: { sourceSoc: string; optionCount: number; wageFloor: string; source: string }) {
  useEffect(() => {
    posthog.capture('pivot_tool_viewed', props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sourceSoc, props.optionCount, props.wageFloor])
  return null
}
