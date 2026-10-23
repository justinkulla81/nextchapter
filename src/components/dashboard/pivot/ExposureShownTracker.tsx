'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

// Fires once per page view when the exposure figures render, never per row.
export function ExposureShownTracker({ soc6, band }: { soc6: string; band: string }) {
  useEffect(() => {
    posthog.capture('ai_exposure_shown', { surface: 'pivots', soc6, band })
  }, [soc6, band])
  return null
}
