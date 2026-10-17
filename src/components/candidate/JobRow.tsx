import Link from 'next/link'
import { cn } from '@/lib/utils'
import { JobActions } from './JobActions'

export type FitVerdict = 'strong' | 'good' | 'possible'
export type FactorState = 'match' | 'gap' | 'unknown'

export interface JobRowData {
  id: string
  title: string
  company: string
  location?: string
  verdict: FitVerdict
  /** One plain reason for the verdict, in the member's own terms. */
  reason: string
  /** One fact about the job, e.g. how crowded it is and why, or when it was posted. */
  fact: string
  href: string
  saved?: boolean
  /** Opens under "Why this fits". */
  factors: { label: string; state: FactorState; note: string }[]
}

const VERDICT: Record<FitVerdict, { label: string; className: string }> = {
  strong: { label: 'Strong fit', className: 'text-success' },
  good: { label: 'Good fit', className: 'text-success' },
  possible: { label: 'Possible fit', className: 'text-muted-foreground' },
}

// One job: what it is, whether it suits this member and why, one fact, two actions.
// The detail is there when asked for, not before.
export function JobRow({ job }: { job: JobRowData }) {
  const v = VERDICT[job.verdict]
  return (
    <li className="space-y-3 py-5">
      <div className="space-y-1">
        <h3 className="text-lg leading-snug font-semibold text-ink">
          <Link href={job.href} className="hover:underline">
            {job.title}
          </Link>{' '}
          <span className="font-normal text-muted-foreground">· {job.company}</span>
        </h3>
        <p className="text-base">
          <span className={cn('font-semibold', v.className)}>{v.label}.</span> {job.reason}
        </p>
        <p className="text-sm text-muted-foreground">{job.fact}</p>
      </div>
      <JobActions job={job} />
    </li>
  )
}
