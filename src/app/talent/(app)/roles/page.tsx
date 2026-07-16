import Link from 'next/link'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'

export default async function RolesPage() {
  const employer = await getTalentDashboardData()
  const roles = await prisma.roleProfile.findMany({
    where: { employerId: employer.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { candidateInteractions: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Roles</h1>
          <p className="mt-1 text-muted-foreground">Roles you&apos;ve posted.</p>
        </div>
        <Button render={<Link href="/talent/roles/new" />}>Post a Role</Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roles posted yet.</p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <Link
              key={role.id}
              href={`/talent/roles/${role.id}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:border-brand"
            >
              <p className="font-medium text-foreground">{role.roleTitle}</p>
              <p className="text-sm text-muted-foreground">
                {[role.primaryFunction, role.roleLevel, role.locationRequirement].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {role._count.candidateInteractions} candidate interaction
                {role._count.candidateInteractions === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
