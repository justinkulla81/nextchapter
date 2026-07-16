import Link from 'next/link'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'

export default async function SavedCandidatesPage() {
  const employer = await getTalentDashboardData()

  const saved = await prisma.candidateInteraction.findMany({
    where: { employerId: employer.id, status: 'SAVED' },
    include: {
      candidate: {
        select: {
          id: true,
          privacyTier: true,
          firstName: true,
          lastName: true,
          highestLevelReached: true,
          primaryFunction: true,
        },
      },
      role: { select: { roleTitle: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved Candidates</h1>
        <p className="mt-1 text-muted-foreground">Candidates you&apos;ve saved for later.</p>
      </div>

      {saved.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved candidates yet.</p>
      ) : (
        <div className="space-y-3">
          {saved.map((interaction) => {
            const c = interaction.candidate
            const label =
              c.privacyTier === 'PUBLIC' && c.firstName
                ? `${c.firstName} ${c.lastName?.charAt(0) ?? ''}.`.trim()
                : `${c.highestLevelReached ?? 'Experienced'} ${c.primaryFunction ?? 'professional'}`
            return (
              <Link
                key={interaction.id}
                href={`/talent/candidates/${c.id}`}
                className="block rounded-lg border border-border p-4 transition-colors hover:border-brand"
              >
                <p className="font-medium text-foreground">{label}</p>
                {interaction.role && (
                  <p className="text-sm text-muted-foreground">Saved for {interaction.role.roleTitle}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
