import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeWorkHistoryFacts,
  type WorkHistoryEntryInput,
  type EducationDateRange,
} from '@/lib/resume/work-history-facts'

export interface WeaknessGuidance {
  flag: string
  label: string
  suggestion: string
}

// Pulls together everything already computed elsewhere (gap detection,
// jobHoppingFlag, careerTrajectory) into short, specific prep guidance —
// distinct from the narrative's coreStatement/adaptations, which stay
// achievement-focused. Nothing here is persisted; it's cheap to recompute
// live so it never goes stale relative to the candidate's actual work
// history.
export async function detectNarrativeWeaknesses(candidateId: string): Promise<WeaknessGuidance[]> {
  const [workHistory, education, profile] = await Promise.all([
    prisma.workHistoryEntry.findMany({ where: { candidateId } }),
    prisma.educationEntry.findMany({ where: { candidateId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { jobHoppingFlag: true, careerTrajectory: true, highestEducationLevel: true },
    }),
  ])

  const workHistoryInputs: WorkHistoryEntryInput[] = workHistory.map((entry) => ({
    companyName: entry.companyName,
    roleTitle: entry.roleTitle,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    departureReason: entry.departureReason,
    engagementType: entry.engagementType,
  }))
  const educationRanges: EducationDateRange[] = education.map((entry) => ({
    startDate: entry.startDate,
    graduationDate: entry.graduationDate,
  }))

  const { gaps } = computeWorkHistoryFacts(workHistoryInputs, educationRanges)
  const guidance: WeaknessGuidance[] = []

  for (const gap of gaps.filter((g) => g.explainedBy === null)) {
    guidance.push({
      flag: 'unexplained_gap',
      label: `Gap after ${gap.afterRole} at ${gap.afterCompany}`,
      suggestion: `You have a gap after your time at ${gap.afterCompany} — have a one-line answer ready: what you did with the time, and one concrete thing you can point to (a course, a project, volunteer work).`,
    })
  }

  if (profile.jobHoppingFlag) {
    guidance.push({
      flag: 'job_hopping',
      label: 'Short-tenure pattern',
      suggestion:
        "Your last few roles were under a year each — be ready to name the pattern's reason (layoffs, a bad market, a wrong-fit sequence) rather than letting each one sound like an isolated story.",
    })
  }

  if (profile.careerTrajectory === 'DEMOTED') {
    guidance.push({
      flag: 'demotion',
      label: 'Step down in scope',
      suggestion:
        "Your most recent move looks like a step down in scope — have a clear, honest one-liner ready (relocation, industry pivot, explicitly choosing IC work) before it's raised.",
    })
  }

  if (profile.highestEducationLevel === 'SOME_COLLEGE') {
    guidance.push({
      flag: 'incomplete_degree',
      label: "Didn't finish degree",
      suggestion:
        "You didn't finish your degree — this comes up less than people fear, but have one sentence ready that doesn't sound defensive.",
    })
  }

  return guidance
}
