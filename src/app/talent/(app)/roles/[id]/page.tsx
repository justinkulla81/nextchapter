import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'

const STATUS_LABEL: Record<string, string> = {
  VIEWED: 'Viewed',
  SAVED: 'Saved',
  INTEREST_EXPRESSED: 'Interest expressed',
  CANDIDATE_REVEALED: 'Candidate revealed',
  IN_CONVERSATION: 'In conversation',
  HIRED: 'Hired',
  PASSED: 'Passed',
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  const role = await prisma.roleProfile.findFirst({
    where: { id, employerId: employer.id },
    include: { candidateInteractions: true },
  })
  if (!role) notFound()

  const statusCounts = role.candidateInteractions.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{role.roleTitle}</h1>
        <p className="mt-1 text-muted-foreground">
          {[role.primaryFunction, role.roleLevel, role.locationRequirement, role.remotePolicy]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {(role.compMin || role.compMax) && (
          <p className="mt-1 text-sm text-muted-foreground">
            ${role.compMin?.toLocaleString() ?? '?'} – ${role.compMax?.toLocaleString() ?? '?'}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Candidate interactions</p>
        {Object.keys(statusCounts).length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No interactions yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status}>
                {STATUS_LABEL[status] ?? status}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button render={<Link href={`/talent/roles/${role.id}/candidates`} />}>View candidate matches</Button>
    </div>
  )
}
