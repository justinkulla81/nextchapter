import 'server-only'
import { prisma } from '@/lib/prisma'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { MOOD_LABEL } from '@/lib/daily/mood-labels'
import type { Grade, HireabilityGrade } from '@/lib/scoring/grade'

export interface FullClientView {
  candidateName: string
  email: string | null
  weekNumber: number | null
  statusLabel: string | null
  targetRoleType: string | null
  primaryFunction: string | null
  targetIndustries: string[]
  gradeHistory: { generatedAt: Date; executionGrade: Grade | null; marketGrade: Grade | null }[]
  workHistory: { companyName: string; roleTitle: string; startDate: Date; endDate: Date | null; isCurrent: boolean }[]
  references: { refereeName: string; wouldHireAgain: boolean | null; status: string }[]
  recentMoods: { label: string; checkedInAt: Date }[]
  sessions: {
    id: string
    occurredAt: Date
    durationMinutes: number | null
    notes: string | null
    directives: string | null
  }[]
}

export async function getFullClientView(candidateId: string): Promise<FullClientView> {
  const [candidate, reports, workHistory, references, moods, sessions] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
    prisma.hireabilityReport.findMany({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      take: 5,
      select: { generatedAt: true, hireabilityGradeAtGeneration: true },
    }),
    prisma.workHistoryEntry.findMany({
      where: { candidateId },
      orderBy: { startDate: 'desc' },
      select: { companyName: true, roleTitle: true, startDate: true, endDate: true, isCurrent: true },
    }),
    prisma.reference.findMany({
      where: { candidateId },
      select: { refereeName: true, wouldHireAgain: true, status: true },
    }),
    prisma.dailyCheckIn.findMany({
      where: { candidateId },
      orderBy: { checkedInAt: 'desc' },
      take: 10,
    }),
    prisma.coachSession.findMany({
      where: { candidateId },
      orderBy: { occurredAt: 'desc' },
      select: { id: true, occurredAt: true, durationMinutes: true, notes: true, directives: true },
    }),
  ])

  const weekNumber = candidate.registrationCompletedAt
    ? Math.floor((Date.now() - candidate.registrationCompletedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : null

  return {
    candidateName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate',
    email: candidate.email,
    weekNumber,
    statusLabel: candidate.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[candidate.currentJobStatus] : null,
    targetRoleType: candidate.targetRoleType,
    primaryFunction: candidate.primaryFunction,
    targetIndustries: candidate.targetIndustries,
    gradeHistory: reports.map((r) => {
      const grade = r.hireabilityGradeAtGeneration as unknown as HireabilityGrade | null
      return {
        generatedAt: r.generatedAt,
        executionGrade: grade?.grade ?? null,
        marketGrade: grade?.grade ?? null,
      }
    }),
    workHistory,
    references: references.map((r) => ({
      refereeName: r.refereeName,
      wouldHireAgain: r.wouldHireAgain,
      status: r.status,
    })),
    recentMoods: moods.map((m) => ({ label: MOOD_LABEL[m.mood], checkedInAt: m.checkedInAt })),
    sessions,
  }
}
