'use client'

import { useState, useTransition } from 'react'
import { reportJobClosed } from '@/app/dashboard/find-my-job/actions'
import { posthog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'

// Shown on jobs listed only through an aggregator (Jooble, Careerjet): we can't check
// those listings ourselves, so say so and let the member tell us when one is closed.
export function ReportClosedButton({ jobId }: { jobId: string }) {
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  if (done) return <p className="text-sm text-success">Thanks. We took this job down for everyone.</p>
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Listed on an aggregator, so it may have closed. We can&apos;t check these ourselves.</p>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            posthog.capture('job_report_closed_clicked', { jobId })
            const r = await reportJobClosed(jobId)
            if (r.ok) setDone(true)
          })
        }
      >
        {pending ? 'Removing…' : 'This job is closed'}
      </Button>
    </div>
  )
}
