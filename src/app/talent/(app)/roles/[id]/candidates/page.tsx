import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { CandidateCard } from '@/components/talent/CandidateCard'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'

export default async function MatchInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  const role = await prisma.roleProfile.findFirst({
    where: { id, employerId: employer.id },
    include: { employer: { select: { companySize: true } } },
  })
  if (!role) notFound()
  const employerCompanySizeBand = mapEmployerCompanySizeStringToBand(role.employer.companySize)

  // Opting in is necessary but not sufficient for full detail — a candidate
  // whose Dossier isn't unlocked yet (real references, evidence, and effort
  // on file) still appears, as an anonymized teaser (see CandidateCard's
  // `locked` prop), not filtered out entirely. This list is already scoped
  // to opted-in candidates first, so a live isDossierUnlocked() call per row
  // in that small result set is fine — no stored snapshot to read instead.
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
      levelRankScore: true,
      priorityMaxComp: true,
      priorityWorkLife: true,
      _count: { select: { learningBadges: true, outreachLogs: true } },
      jobPostings: { select: { appliedAt: true } },
    },
    take: 200,
  })

  const unlockStatuses = await Promise.all(candidatesRaw.map((c) => isDossierUnlocked(c.id)))
  const unlockedCandidates = candidatesRaw.filter((_, i) => unlockStatuses[i].unlocked).slice(0, 100)
  const lockedCandidates = candidatesRaw.filter((_, i) => !unlockStatuses[i].unlocked).slice(0, 50)

  // Built once, outside the nested scoring function — spreading `role`
  // itself inside a nested closure confused TS's narrowing of the earlier
  // `if (!role) notFound()` check, widening roleLevel etc. to include
  // `undefined`. Building the merged object at the top level keeps its type
  // concrete for both scoring calls below.
  const roleForMatching = { ...role, employerCompanySizeBand }

  function scoreCandidates(list: typeof candidatesRaw) {
    return list
      .map((candidate) => {
        const effortSummary = computeEffortSummaryLines({
          learningCount: candidate._count.learningBadges,
          applicationsCount: candidate.jobPostings.filter((j) => j.appliedAt !== null).length,
          outreachCount: candidate._count.outreachLogs,
        })
          .map((line) => line.replace(/\.$/, ''))
          .join(', ')
        return { candidate, match: computeMatchScore(candidate, roleForMatching), effortSummary }
      })
      .sort((a, b) => b.match.score - a.match.score)
  }

  const scored = scoreCandidates(unlockedCandidates)
  const scoredLocked = scoreCandidates(lockedCandidates)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate matches</h1>
        <p className="mt-1 text-muted-foreground">For {role.roleTitle}.</p>
      </div>

      {scored.length === 0 && scoredLocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching candidates yet — check back as more candidates complete their assessment.
        </p>
      ) : (
        <>
          {scored.length > 0 && (
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

          {scoredLocked.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  More matches — Dossier not yet unlocked ({scoredLocked.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Real matches, name withheld until they have real references, evidence, and effort on file.
                  Express interest now and we&apos;ll let them know — they&apos;ll see it in their dashboard.
                </p>
              </div>
              {scoredLocked.map(({ candidate, match, effortSummary }) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  match={match}
                  roleId={role.id}
                  effortSummary={effortSummary}
                  locked
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
