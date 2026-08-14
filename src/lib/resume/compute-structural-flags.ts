import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  computeWorkHistoryFacts,
  detectCareerTrajectory,
  JOB_HOPPING_SHORT_TENURE_THRESHOLD,
  type WorkHistoryEntryInput,
  type EducationDateRange,
} from '@/lib/resume/work-history-facts'
import { computePedigreeBonus } from '@/lib/scoring/pedigree-bonus'

// Recomputes the Market Reality structural flags (jobHoppingFlag,
// shortTenureCount, careerTrajectory) from a candidate's current
// WorkHistoryEntry/EducationEntry rows. Called after resume upload (once
// the parsing sync has run) and after any manual work-history create/
// update/delete, so the flags never go stale relative to what's actually
// on file.
export async function computeStructuralFlags(candidateId: string): Promise<void> {
  const [workHistory, education] = await Promise.all([
    prisma.workHistoryEntry.findMany({ where: { candidateId } }),
    prisma.educationEntry.findMany({ where: { candidateId } }),
  ])

  const workHistoryInputs: WorkHistoryEntryInput[] = workHistory.map((entry) => ({
    companyName: entry.companyName,
    roleTitle: entry.roleTitle,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    departureReason: entry.departureReason,
    engagementType: entry.engagementType,
    teamSize: entry.teamSize,
  }))
  const educationRanges: EducationDateRange[] = education.map((entry) => ({
    startDate: entry.startDate,
    graduationDate: entry.graduationDate,
  }))

  const { shortTenureCount } = computeWorkHistoryFacts(workHistoryInputs, educationRanges)
  const careerTrajectory = detectCareerTrajectory(workHistoryInputs)
  const pedigree = await computePedigreeBonus(candidateId)

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      shortTenureCount,
      jobHoppingFlag: shortTenureCount >= JOB_HOPPING_SHORT_TENURE_THRESHOLD,
      careerTrajectory,
      promotionVelocity: pedigree.promotionVelocity,
      pedigreeBonus: pedigree.bonus,
      pedigreeSignals: JSON.parse(JSON.stringify(pedigree.signals)),
    },
  })
}
