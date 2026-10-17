'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { alternativesHrefs } from '@/lib/jobs/job-status'

// Next steps for a job that has closed: open jobs at the same company, and open jobs
// with the same title. Links into the live board search — past jobs never get an
// apply button, these do.

export function ClosedJobAlternatives({ jobId, companyName, title, surface }: { jobId: string; companyName: string | null; title: string; surface: string }) {
  const hrefs = alternativesHrefs(companyName, title)
  const track = (kind: 'company' | 'title') => posthog.capture('closed_job_alternatives_clicked', { jobId, kind, surface })
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {hrefs.company && (
        <Link href={hrefs.company} onClick={() => track('company')} className="font-medium text-primary underline underline-offset-4">
          See open jobs at {companyName}
        </Link>
      )}
      <Link href={hrefs.title} onClick={() => track('title')} className="font-medium text-primary underline underline-offset-4">
        See open {hrefs.titleLabel} jobs
      </Link>
    </p>
  )
}
