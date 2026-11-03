'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

export function LeadTracker({ offer }: { offer: string }) {
  useEffect(() => {
    posthog.capture('lead_page_viewed', { offer })
  }, [offer])
  return null
}
