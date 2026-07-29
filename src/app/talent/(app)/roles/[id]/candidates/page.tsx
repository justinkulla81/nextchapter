import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { CandidateCard } from '@/components/talent/CandidateCard'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'

export default async function MatchInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  const role = await prisma.roleProfile.findFirst({ where: { id, employerId: employer.id } })
  if (!role) notFound()

  // Opting in is necessary but not sufficient — a candidate is only actually
  // surfaced here while their current standing (latest report snapshot) is
  // an A Market Reality Grade. Live-recomputing the grade for up to 100
  // candidates on every match-inbox load would be too expensive (per-
  // candidate market-data lookups); the latest stored snapshot is the same
  // "current standing" source of truth used elsewhere (Full Client View,
  // Session Impact Report).
  const candidatesRaw = await prisma.candidateProfile.findMany({
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
      hireabilityReports: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { hireabilityGradeAtGeneration: true },
      },
      _count: { select: { learningBadges: true, outreachLogs: true } },
      jobPostings: { select: { appliedAt: true } },
    },
    take: 200,
  })

  const candidates = candidatesRaw
    .filter((c) => {
      const grade = normalizeGradeSnapshot(c.hireabilityReports[0]?.hireabilityGradeAtGeneration)
      return grade?.grade === 'A'
    })
    .slice(0, 100)

  const scored = candidates
    .map((candidate) => {
      const effortSummary = computeEffortSummaryLines({
        learningCount: candidate._count.learningBadges,
        applicationsCount: candidate.jobPostings.filter((j) => j.appliedAt !== null).length,
        outreachCount: candidate._count.outreachLogs,
      })
        .map((line) => line.replace(/\.$/, ''))
        .join(', ')
      return { candidate, match: computeMatchScore(candidate, role), effortSummary }
    })
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
          {scored.map(({ candidate, match, effortSummary }) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              match={match}
              roleId={role.id}
              effortSummary={effortSummary}
            />
          ))}
        </div>
      )}
    </div>
  )
}
