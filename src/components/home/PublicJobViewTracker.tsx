'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'

/** Fires public_job_page_viewed once when a public job page (/jobs/[id]) shows. Renders nothing. */
export function PublicJobViewTracker({ jobId, company, remote, hasPay }: { jobId: string; company: string; remote: boolean; hasPay: boolean }) {
  useEffect(() => {
    posthog.capture('public_job_page_viewed', { jobId, company, remote, hasPay, referrer: document.referrer || null })
  }, [jobId, company, remote, hasPay])
  return null
}
