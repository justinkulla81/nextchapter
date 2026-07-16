import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { CandidateCard } from '@/components/talent/CandidateCard'

export default async function MatchInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  const role = await prisma.roleProfile.findFirst({ where: { id, employerId: employer.id } })
  if (!role) notFound()

  const candidates = await prisma.candidateProfile.findMany({
    where: {
      recruiterDatabaseOptIn: true,
      privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC', 'PRIVATE'] },
      assessmentComplete: true,
    },
    select: {
      id: true,
      privacyTier: true,
      firstName: true,
      lastName: true,
      highestLevelReached: true,
      primaryFunction: true,
      currentCity: true,
      remotePreference: true,
      openToRelocation: true,
      targetCompMin: true,
      compFlexible: true,
    },
    take: 100,
  })

  const scored = candidates
    .map((candidate) => ({ candidate, match: computeMatchScore(candidate, role) }))
    .sort((a, b) => b.match.score - a.match.score)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate matches</h1>
        <p className="mt-1 text-muted-foreground">For {role.roleTitle}.</p>
      </div>

      {scored.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching candidates yet — check back as more candidates complete their assessment.
        </p>
      ) : (
        <div className="space-y-3">
          {scored.map(({ candidate, match }) => (
            <CandidateCard key={candidate.id} candidate={candidate} match={match} roleId={role.id} />
          ))}
        </div>
      )}
    </div>
  )
}
