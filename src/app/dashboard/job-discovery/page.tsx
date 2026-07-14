import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { refreshSurfacedJobs } from '@/app/dashboard/job-discovery/actions'
import { SurfacedJobCard } from '@/components/dashboard/SurfacedJobCard'
import { JobReactionSummary } from '@/components/dashboard/JobReactionSummary'
import { Button } from '@/components/ui/button'

export default async function JobDiscoveryPage() {
  const profile = await getDashboardData()
  const jobs = await prisma.surfacedJob.findMany({
    where: { candidateId: profile.id },
    orderBy: { surfacedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Discovery</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs surfaced to learn from your reactions — not a mass-apply queue. React honestly; the more you do,
          the sharper the read on where to focus.
        </p>
      </div>

      <form action={refreshSurfacedJobs}>
        <Button type="submit" variant="outline">
          Find new jobs
        </Button>
      </form>

      <JobReactionSummary />

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No jobs surfaced yet — set a target role in your Goals, then click &ldquo;Find new jobs&rdquo; above.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <SurfacedJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
