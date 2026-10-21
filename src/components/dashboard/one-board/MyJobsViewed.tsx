'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires my_jobs_viewed once per visit to the My jobs view. */
export function MyJobsViewed(props: { saved: number; applied: number; interviewing: number; offer: number; prompts: number; fromEmail: number }) {
  const key = JSON.stringify(props)
  useEffect(() => {
    posthog.capture('my_jobs_viewed', JSON.parse(key))
  }, [key])
  return null
}
