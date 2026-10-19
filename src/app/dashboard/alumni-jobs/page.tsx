import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { listAlumniJobs } from '@/lib/jobs/alumni-jobs'

import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'

export const metadata: Metadata = { title: 'Alumni jobs' }

export default async function AlumniJobsPage() {
  const profile = await getDashboardProfile()
  const jobs = await listAlumniJobs(profile.id)

  if (isRedesignOn(profile.email)) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Alumni jobs"
          intro="Roles employers posted just for your school’s alumni. They are not on the open board, so fewer people see them."
          action={
            jobs.length === 0 ? (
              <ActionLink href="/dashboard/find-my-job" kind="primary" event="alumni_jobs_find_job_clicked" props={{ source: 'alumni_jobs_empty' }}>
                Find a job
              </ActionLink>
            ) : undefined
          }
        />
        {jobs.length === 0 ? (
          <section className="space-y-2 rounded-2xl border border-border p-7">
            <h2 className="font-display text-xl font-semibold text-ink">Nothing posted for your school yet</h2>
            <p className="max-w-2xl text-base text-muted-foreground">When an employer posts a role for your school’s alumni, it shows up here with the reason it is for you.</p>
          </section>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-base font-semibold text-ink">{j.title}</p>
                  <p className="text-sm text-ink">Posted for {j.institutionName ? `${j.institutionName} alumni` : 'alumni of your school'}, so you are in a smaller group of applicants.</p>
                  <p className="text-sm text-muted-foreground">{[j.companyName, j.location].filter(Boolean).join(' · ')}</p>
                </div>
                <ActionLink href={j.url} external event="alumni_job_opened" props={{ jobId: j.id, institution: j.institutionName }}>
                  See the role
                </ActionLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Alumni jobs</h1>
        <p className="text-muted-foreground">
          Roles employers posted just for your school&apos;s alumni. They are not on the open board.
        </p>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing here yet. When an employer posts a role for your school, it shows up here.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {jobs.map((j) => (
            <a
              key={j.id}
              href={j.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-muted"
            >
              <p className="font-medium text-foreground">{j.title}</p>
              <p className="text-sm text-muted-foreground">
                {[j.companyName, j.location, `For ${j.institutionName} alumni`].filter(Boolean).join(' · ')}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
