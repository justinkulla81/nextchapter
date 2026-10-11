import { getCurrentInstitutionUser } from '@/lib/institution/auth'
import { can } from '@/lib/institution/permissions'
import { prisma } from '@/lib/prisma'
import { AlumniJobForm } from '@/components/institution/AlumniJobForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { archiveAlumniJob } from './actions'

const STATUS: Record<string, string> = { pending: 'Awaiting review', approved: 'Live for alumni', rejected: 'Not approved' }

export default async function InstitutionJobsPage() {
  const user = await getCurrentInstitutionUser()
  const jobs = await prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: user.institutionId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, companyName: true, location: true, status: true, createdAt: true },
  })
  const canPost = can(user.role, 'post_jobs')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alumni jobs</h1>
        <p className="text-muted-foreground">
          Roles only {user.institutionName} alumni on NextChapter can see. They are not on the open board.
        </p>
      </div>
      {canPost && <AlumniJobForm />}
      <div className="divide-y divide-border rounded-lg border border-border">
        {jobs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No alumni jobs yet.</p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">{j.title}</p>
                <p className="text-sm text-muted-foreground">
                  {[j.companyName, j.location, STATUS[j.status] ?? j.status].filter(Boolean).join(' · ')}
                </p>
              </div>
              {canPost && (
                <form action={archiveAlumniJob.bind(null, j.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
