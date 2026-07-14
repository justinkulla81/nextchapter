import type { SurfacedJob, NotInterestedReason } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { reactToJob } from '@/app/dashboard/job-discovery/actions'

const REASON_OPTIONS: { value: NotInterestedReason; label: string }[] = [
  { value: 'WRONG_FUNCTION', label: 'Wrong function' },
  { value: 'WRONG_INDUSTRY', label: 'Wrong industry' },
  { value: 'COMP_TOO_LOW', label: 'Compensation too low' },
  { value: 'SENIORITY_MISMATCH', label: 'Too senior or too junior' },
  { value: 'LOCATION_MISMATCH', label: 'Location or flexibility mismatch' },
  { value: 'MISSING_EXPERIENCE', label: 'Missing required experience' },
  { value: 'COMPANY_UNATTRACTIVE', label: 'Company unattractive' },
  { value: 'DONT_FEEL_QUALIFIED', label: "Sounds interesting but I don't feel qualified" },
  { value: 'WOULD_PURSUE_WITH_CONNECTION', label: 'Would pursue if I had a connection inside' },
]

const REACTION_LABEL: Record<string, string> = {
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not interested',
  UNSURE: 'Unsure',
}

export function SurfacedJobCard({ job }: { job: SurfacedJob }) {
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

      {job.reaction ? (
        <p className="text-sm text-muted-foreground">
          You reacted: <span className="font-medium text-foreground">{REACTION_LABEL[job.reaction]}</span>
          {job.reactionReason && ` (${REASON_OPTIONS.find((r) => r.value === job.reactionReason)?.label})`}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <form action={reactToJob.bind(null, job.id, 'INTERESTED', null)}>
              <Button type="submit" size="sm">
                Interested
              </Button>
            </form>
            <form action={reactToJob.bind(null, job.id, 'UNSURE', null)}>
              <Button type="submit" variant="outline" size="sm">
                Unsure
              </Button>
            </form>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Not interested</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {REASON_OPTIONS.map((reason) => (
                <form key={reason.value} action={reactToJob.bind(null, job.id, 'NOT_INTERESTED', reason.value)}>
                  <Button type="submit" variant="outline" size="sm">
                    {reason.label}
                  </Button>
                </form>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
