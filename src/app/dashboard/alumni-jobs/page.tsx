import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { listAlumniJobs } from '@/lib/jobs/alumni-jobs'

export const metadata: Metadata = { title: 'Alumni jobs' }

export default async function AlumniJobsPage() {
  const profile = await getDashboardData()
  const jobs = await listAlumniJobs(profile.id)

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
