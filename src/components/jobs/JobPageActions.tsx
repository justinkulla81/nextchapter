'use client'

import { useEffect } from 'react'
import { posthog } from '@/lib/posthog/client'
import { recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { Button } from '@/components/ui/button'

// The one action on a job's own page: apply while it is open; on a past job, a
// plain "Closed" label (never an apply button) and the closed_job_viewed event.

export function ClosedJobViewed({ jobId, source, status }: { jobId: string; source: string; status: string }) {
  useEffect(() => {
    posthog.capture('closed_job_viewed', { jobId, source, status })
  }, [jobId, source, status])
  return null
}

export function ApplyOnEmployerSite({ job }: { job: { id: string; title: string; companyName: string; location: string | null; url: string } }) {
  function handleClick() {
    void recordJobClick({ source: 'job_board', sourceId: job.id, jobTitle: job.title, companyName: job.companyName, location: job.location, url: job.url, fitBucket: null })
  }
  return (
    <Button nativeButton={false} render={<a href={job.url} target="_blank" rel="noopener noreferrer" onClick={handleClick} />}>
      Apply on the employer&apos;s site
    </Button>
  )
}
