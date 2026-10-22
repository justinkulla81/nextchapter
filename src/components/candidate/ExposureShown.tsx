'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'
import type { ExposureEventProps } from '@/lib/skills/ai-at-work-shared'

/** Fires `ai_exposure_shown` once when an AI exposure block is on the page. Renders nothing. */
export function ExposureShown({ surface, soc6, band, hasSplit }: ExposureEventProps) {
  useEffect(() => {
    posthog.capture('ai_exposure_shown', { surface, soc6, band, hasSplit })
  }, [surface, soc6, band, hasSplit])
  return null
}
