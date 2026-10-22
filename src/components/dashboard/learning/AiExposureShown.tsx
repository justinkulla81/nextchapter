'use client'

import { useEffect } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import type { ExposureBand, RetrainingNeed } from '@/lib/skills/ai-exposure'

/** Fires ai_exposure_shown once per page view. Renders nothing. */
export function AiExposureShown({ soc6, band, need }: { soc6: string | null; band: ExposureBand | null; need: RetrainingNeed }) {
  const posthog = usePostHog()
  useEffect(() => {
    posthog.capture('ai_exposure_shown', { surface: 'learning', soc6, band, need })
  }, [posthog, soc6, band, need])
  return null
}
