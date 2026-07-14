import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import type { CommittedAction } from '@/lib/weekly/sprint'

export interface AListResult {
  memberCandidateIds: Set<string>
  memberNames: string[] // "First L."
  count: number
}

// A-List membership for the week that's ending: earned when every committed
// action was completed AND the Search Execution grade for the week is an A —
// "everyone can bring this one to an A" only holds if follow-through counts.
export async function computeAList(weekStartDate: Date): Promise<AListResult> {
  const sprints = await prisma.weeklySprint.findMany({ where: { weekStartDate } })

  const memberCandidateIds = new Set<string>()
  const memberNames: string[] = []

  for (const sprint of sprints) {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    if (actions.length === 0) continue
    const allCompleted = actions.every((a) => a.completed)
    if (!allCompleted) continue

    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: sprint.candidateId },
      include: {
        references: true,
        workSamples: true,
        workHistory: true,
        linkedInActivityLogs: true,
        jobPostings: true,
        resumes: true,
        communityPosts: true,
      },
    })
    if (!candidate) continue

    const grade = await computeHireabilityGrade(candidate as unknown as CandidateWithGradeRelations)
    if (grade.searchExecution.grade !== 'A') continue

    memberCandidateIds.add(candidate.id)
    if (candidate.firstName) {
      const lastInitial = candidate.lastName ? `${candidate.lastName[0]}.` : ''
      memberNames.push(`${candidate.firstName} ${lastInitial}`.trim())
    }
  }

  return { memberCandidateIds, memberNames, count: memberCandidateIds.size }
}
