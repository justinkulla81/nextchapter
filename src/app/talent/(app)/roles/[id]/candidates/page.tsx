import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { CandidateCard } from '@/components/talent/CandidateCard'
import { loadVisibilityMany } from '@/lib/evidence/load'
import { compareByEvidenceThenFit } from '@/lib/evidence/score'
import { computeEffortSummaryLines } from '@/lib/reports/effort-summary'

export default async function MatchInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getTalentDashboardData()

  // Candidate+ is the only gate (Justin, 2026-10-16): a member must opt in AND be
  // Candidate+ to be shown to employers at all. Free members are never listed,
  // not even as teasers. Candidate+ Verified members (Candidate+ plus at least one
  // reference, work sample or review) come first, with an Evidence badge. The
  // opted-in set is small, so a live Candidate+ check per row is fine.
  const [role, candidatesRaw] = await Promise.all([
    prisma.roleProfile.findFirst({
      where: { id, employerId: employer.id },
      include: { employer: { select: { companySize: true } } },
    }),
    prisma.candidateProfile.findMany({
      where: {
        recruiterDatabaseOptIn: true,
        // Confidential search is a hard rule: nothing about these members, including
        // their Candidate+ status, is visible to anyone outside NextChapter.
        confidentialSearchMode: false,
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
    }),
  ])
  if (!role) notFound()
  const employerCompanySizeBand = mapEmployerCompanySizeStringToBand(role.employer.companySize)

  const visibility = await loadVisibilityMany(candidatesRaw.map((c) => c.id))
  const visibleCandidates = candidatesRaw.filter((c) => visibility.get(c.id)?.candidatePlus).slice(0, 100)

  // Built once, outside the nested scoring function — spreading `role`
  // itself inside a nested closure confused TS's narrowing of the earlier
  // `if (!role) notFound()` check, widening roleLevel etc. to include
  // `undefined`. Building the merged object at the top level keeps its type
  // concrete for the scoring below.
  const roleForMatching = { ...role, employerCompanySizeBand }

  const scored = visibleCandidates
    .map((candidate) => {
      const effortSummary = computeEffortSummaryLines({
        learningCount: candidate._count.learningBadges,
        applicationsCount: candidate.jobPostings.filter((j) => j.appliedAt !== null).length,
        outreachCount: candidate._count.outreachLogs,
      })
        .map((line) => line.replace(/\.$/, ''))
        .join(', ')
      const v = visibility.get(candidate.id)!
      return { candidate, match: computeMatchScore(candidate, roleForMatching), effortSummary, evidence: { verified: v.verified, score: v.score } }
    })
    .sort((a, b) =>
      compareByEvidenceThenFit(
        { verified: a.evidence.verified, evidenceScore: a.evidence.score, fit: a.match.score },
        { verified: b.evidence.verified, evidenceScore: b.evidence.score, fit: b.match.score }
      )
    )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate matches</h1>
        <p className="mt-1 text-muted-foreground">For {role.roleTitle}.</p>
      </div>

      {scored.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching Candidate+ members yet. Members appear here once they have opted in to be found and earned Candidate+ (real
          outreach, applications, search effort and an assessment on file). Check back as more members qualify.
        </p>
      ) : (
        <div className="space-y-3">
          {scored.map(({ candidate, match, effortSummary, evidence }) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              match={match}
              roleId={role.id}
              effortSummary={effortSummary}
              evidence={evidence}
            />
          ))}
        </div>
      )}
    </div>
  )
}
