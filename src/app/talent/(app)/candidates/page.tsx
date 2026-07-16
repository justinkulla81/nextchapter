import Link from 'next/link'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'

const STATUS_LABEL: Record<string, string> = {
  VIEWED: 'Viewed',
  SAVED: 'Saved',
  INTEREST_EXPRESSED: 'Interest expressed',
  CANDIDATE_REVEALED: 'Candidate revealed',
  IN_CONVERSATION: 'In conversation',
  HIRED: 'Hired',
  PASSED: 'Passed',
}

export default async function CandidateInboxPage() {
  const employer = await getTalentDashboardData()

  const interactions = await prisma.candidateInteraction.findMany({
    where: { employerId: employer.id },
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
        <h1 className="text-2xl font-semibold tracking-tight">Candidate Inbox</h1>
        <p className="mt-1 text-muted-foreground">Everyone you&apos;ve interacted with, across all roles.</p>
      </div>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No candidate interactions yet — post a role and visit its candidate matches to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction) => {
            const c = interaction.candidate
            const label =
              c.privacyTier === 'PUBLIC' && c.firstName
                ? `${c.firstName} ${c.lastName?.charAt(0) ?? ''}.`.trim()
                : `${c.highestLevelReached ?? 'Experienced'} ${c.primaryFunction ?? 'professional'}`
            return (
              <Link
                key={interaction.id}
                href={`/talent/candidates/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 transition-colors hover:border-brand"
              >
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  {interaction.role && (
                    <p className="text-sm text-muted-foreground">{interaction.role.roleTitle}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[interaction.status] ?? interaction.status}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
