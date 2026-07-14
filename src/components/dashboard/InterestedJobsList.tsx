'use client'

import { useActionState } from 'react'
import type { SurfacedJob } from '@prisma/client'
import { createCoverLetterFromSurfacedJob } from '@/app/dashboard/job-fit/actions'
import { Button } from '@/components/ui/button'

function InterestedJobRow({ job }: { job: SurfacedJob }) {
  const [state, formAction, pending] = useActionState(createCoverLetterFromSurfacedJob.bind(null, job.id), undefined)

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div>
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {job.title}
        </a>
        {(job.companyName || job.location) && (
          <p className="text-sm text-muted-foreground">
            {[job.companyName, job.location].filter(Boolean).join(' — ')}
          </p>
        )}
      </div>
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={pending} className={pending ? 'cursor-progress' : ''}>
          {pending ? 'Drafting…' : 'Create cover letter'}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}

// Jobs the candidate reacted "Interested" to but hasn't yet turned into a
// tracked Job Fit entry — clicking "Create cover letter" promotes it (fetches
// the full posting, runs fit analysis, drafts the letter) and it moves up
// into the tracked list above.
export function InterestedJobsList({ jobs }: { jobs: SurfacedJob[] }) {
  if (jobs.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">Interested jobs</h2>
      {jobs.map((job) => (
        <InterestedJobRow key={job.id} job={job} />
      ))}
    </div>
  )
}
