import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { getEngagedCandidateComparison } from '@/lib/talent/role-comparison'

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
    include: { candidateInteractions: true, employer: { select: { companySize: true } } },
  })
  if (!role) notFound()

  const statusCounts = role.candidateInteractions.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {})

  const comparison = await getEngagedCandidateComparison(role, mapEmployerCompanySizeStringToBand(role.employer.companySize))

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

      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              How candidates you&apos;ve engaged with compare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-foreground">
            <p>
              {comparison.engagedCount} candidate{comparison.engagedCount > 1 ? 's' : ''} you&apos;ve expressed
              interest in, revealed, talked with, or hired for this role.
            </p>
            {role.primaryFunction && comparison.differentFunctionCount > 0 && (
              <p>
                {comparison.differentFunctionCount} of {comparison.engagedCount} come from a different function
                than posted.
              </p>
            )}
            {comparison.levelHigherCount > 0 && (
              <p>{comparison.levelHigherCount} are more senior than the posted level.</p>
            )}
            {comparison.levelLowerCount > 0 && (
              <p>{comparison.levelLowerCount} are less senior than the posted level.</p>
            )}
            {comparison.avgCandidateTargetComp != null && (
              <p>
                Average target comp among these candidates: ${comparison.avgCandidateTargetComp.toLocaleString()}
                {role.compMax != null &&
                  comparison.compAboveRoleMaxCount > 0 &&
                  ` — ${comparison.compAboveRoleMaxCount} want more than your posted range.`}
              </p>
            )}
            {comparison.wantsRemoteCount > 0 && (
              <p>
                {comparison.wantsRemoteCount} of {comparison.engagedCount} want remote or flexible work
                {role.remotePolicy && role.remotePolicy !== 'remote' ? " — your posting doesn't offer that." : '.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Button nativeButton={false} render={<Link href={`/talent/roles/${role.id}/candidates`} />}>View candidate matches</Button>
    </div>
  )
}
