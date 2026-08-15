import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ScorecardRecommendation, Prisma } from '@prisma/client'
import type { CompetencyScores, ScorecardComparisonRow } from '@/lib/hiring/scorecard-constants'

export { COMPETENCY_KEYS, COMPETENCY_KEY_LABEL } from '@/lib/hiring/scorecard-constants'
export type { CompetencyScoreEntry, CompetencyScores, ScorecardComparisonRow } from '@/lib/hiring/scorecard-constants'

// §A8 — "each panelist submits a scorecard scored against their assigned
// competency (and can see/fill others if relevant)." scores can cover any
// subset of the five keys — a panelist isn't required to fill all five,
// only encouraged to focus on their assignedCompetency.
export async function submitScorecard(
  scorecardToken: string,
  scores: CompetencyScores,
  overallRecommendation: ScorecardRecommendation | null,
  overallNotes: string
): Promise<{ error?: string }> {
  const panelist = await prisma.interviewPanelist.findUnique({ where: { scorecardToken } })
  if (!panelist) return { error: 'This scorecard link is invalid.' }

  const entries = Object.entries(scores).filter(([, v]) => v && v.score >= 1 && v.score <= 5)
  if (entries.length === 0) return { error: 'Score at least one competency.' }

  const cleanedScores = Object.fromEntries(
    entries.map(([k, v]) => [k, { score: v!.score, notes: v!.notes.trim() }])
  ) as Prisma.InputJsonValue

  await prisma.scorecard.upsert({
    where: { panelistId: panelist.id },
    create: {
      panelistId: panelist.id,
      submissionId: (await prisma.interviewPanel.findUniqueOrThrow({ where: { id: panelist.panelId } })).submissionId,
      competencyScores: cleanedScores,
      overallRecommendation,
      overallNotes: overallNotes.trim() || null,
      submittedAt: new Date(),
    },
    update: {
      competencyScores: cleanedScores,
      overallRecommendation,
      overallNotes: overallNotes.trim() || null,
      submittedAt: new Date(),
    },
  })
  return {}
}

export async function getPanelistByToken(scorecardToken: string) {
  return prisma.interviewPanelist.findUnique({
    where: { scorecardToken },
    include: { panel: { include: { submission: { include: { candidate: { select: { firstName: true, lastName: true } } } } } }, scorecard: true },
  })
}

// §A8's next item after the scorecard — "side-by-side comparison view
// showing all panelists' scores on shared evidence for a candidate."
export async function getScorecardComparison(submissionId: string): Promise<ScorecardComparisonRow[]> {
  const panel = await prisma.interviewPanel.findUnique({
    where: { submissionId },
    include: { panelists: { include: { scorecard: true }, orderBy: { createdAt: 'asc' } } },
  })
  if (!panel) return []

  return panel.panelists.map((p) => ({
    panelistName: p.name,
    assignedCompetency: p.assignedCompetency,
    submitted: Boolean(p.scorecard?.submittedAt),
    overallRecommendation: p.scorecard?.overallRecommendation ?? null,
    scores: (p.scorecard?.competencyScores as CompetencyScores | undefined) ?? {},
  }))
}
