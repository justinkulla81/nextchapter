import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { EqOverIqApplicationRow } from '@/components/admin/EqOverIqApplicationRow'

export const maxDuration = 30

export default async function EqOverIqApplicationsAdminPage() {
  await requireAdmin()

  const [applications, authUsers] = await Promise.all([
    prisma.eqOverIqContributorProfile.findMany({
      where: { submittedAt: { not: null }, status: 'PENDING' },
      orderBy: { submittedAt: 'asc' },
    }),
    listAllAuthUsers(),
  ])

  const rows = applications.map((a) => ({
    id: a.id,
    fullName: a.fullName ?? '',
    email: getAuthEmail(authUsers, a.userId),
    background: a.background ?? '',
    experienceSummary: a.experienceSummary ?? '',
    portfolioLinks: a.portfolioLinks,
    interestAreas: a.interestAreas,
    whyFractionalAiWork: a.whyFractionalAiWork ?? '',
    submittedAt: a.submittedAt!.toLocaleDateString(),
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">EQoverIQ Applications</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} contributor applications awaiting review.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending applications.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <EqOverIqApplicationRow key={row.id} {...row} />
          ))}
        </div>
      )}
    </div>
  )
}
