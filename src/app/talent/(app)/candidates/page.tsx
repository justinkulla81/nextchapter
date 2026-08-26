import Link from 'next/link'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getBlockedCandidateIdsForEmployer } from '@/lib/talent/conflict-check'

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

  const [interactionsRaw, blockedCandidateIds] = await Promise.all([
    prisma.candidateInteraction.findMany({
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
    }),
    // Exclude any candidate this employer has an active conflict-of-
    // interest flag against — see src/lib/talent/conflict-check.ts, ported
    // from the retired Hiring Manager portal's §A8/§E3.5 conflict rule as
    // part of the /hiring -> /talent consolidation.
    getBlockedCandidateIdsForEmployer(employer.id),
  ])
  const interactions = interactionsRaw.filter((i) => !blockedCandidateIds.has(i.candidateId))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate Inbox</h1>
        <p className="mt-1 text-muted-foreground">Everyone you&apos;ve interacted with, across all roles.</p>
      </div>

      {/* Dense divide-y row list, not spaced cards — Partners Master Build
          Script §B6: partner surfaces default to the table/list pattern,
          card-based lists are the candidate-side convention. */}
      <div className="divide-y divide-border rounded-lg border border-border">
        {interactions.length === 0 ? (
          <p className="flex min-h-[var(--row-height-partner)] items-center px-4 py-2 text-sm text-muted-foreground">
            No candidate interactions yet — post a role and visit its candidate matches to get started.
          </p>
        ) : (
          interactions.map((interaction) => {
            const c = interaction.candidate
            const label =
              c.privacyTier === 'PUBLIC' && c.firstName
                ? `${c.firstName} ${c.lastName?.charAt(0) ?? ''}.`.trim()
                : `${c.highestLevelReached ?? 'Experienced'} ${c.primaryFunction ?? 'professional'}`
            return (
              <Link
                key={interaction.id}
                href={`/talent/candidates/${c.id}`}
                className="flex min-h-[var(--row-height-partner)] items-center justify-between gap-4 px-4 py-2 hover:bg-muted"
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
          })
        )}
      </div>
    </div>
  )
}
