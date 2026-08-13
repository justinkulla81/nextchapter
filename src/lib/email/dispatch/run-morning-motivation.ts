import 'server-only'
import type { PrivacyTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendWeeklyGoalAssignedEmail } from '@/lib/email/send-weekly-goal-assigned'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import type { CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { CANONICAL_ACTION_LABEL } from '@/lib/weekly/canonical-labels'

// isGoalBonus rows are the one-time welcome/commitment credit, not a real
// action — same filter SuccessSprintCard.tsx applies before rendering.
// Labels are looked up live via CANONICAL_ACTION_LABEL rather than trusting
// the stored `text` snapshot, so a copy edit to a catalog label is reflected
// here too (see canonical-labels.ts).
function actionLabels(actions: CommittedAction[]): string[] {
  return actions.filter((a) => !a.isGoalBonus).map((a) => CANONICAL_ACTION_LABEL[a.actionType ?? ''] ?? a.text)
}

// Monday — "Morning Motivation." The auto-assign-sprint cron (still its own
// vercel.json entry, 9:00 UTC Mondays) creates this week's WeeklySprint row;
// this only sends the recap+preview email once that row exists. If the
// dispatcher's Monday tick somehow runs before auto-assign-sprint finishes
// for a given candidate, that candidate is silently skipped this run rather
// than erroring — same defensive posture the original inline code had.
export async function runMorningMotivation(introCopy: string | null, eligiblePrivacyTiers: PrivacyTier[]) {
  const weekStartDate = getMondayOfWeek(new Date())
  const priorMonday = new Date(weekStartDate)
  priorMonday.setUTCDate(priorMonday.getUTCDate() - 7)

  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      weeklyReportOptedOut: false,
      ...(eligiblePrivacyTiers.length > 0 ? { privacyTier: { in: eligiblePrivacyTiers } } : {}),
    },
    include: {
      references: true,
      workSamples: true,
      workHistory: true,
      resumes: { orderBy: { uploadedAt: 'desc' } },
      jobPostings: { orderBy: { createdAt: 'desc' } },
      communityPosts: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      surfacedJobs: { select: { reaction: true } },
      linkedInActivityLogs: true,
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      performanceAssessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      _count: { select: { weeklySprints: true } },
      coach: { select: { focus: true } },
    },
  })

  let sentCount = 0
  for (const candidate of eligible) {
    try {
      if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
      if (await hasAlreadySentToday(candidate.id, 'MORNING_MOTIVATION')) continue

      const currentSprint = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate } },
      })
      if (!currentSprint) continue // this week's sprint hasn't been assigned yet

      const priorSprint = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate: priorMonday } },
      })
      if (!priorSprint) continue // no prior week to recap — first-ever sprint

      const weekNumber = candidate._count.weeklySprints
      const priorActions = priorSprint.committedActions as unknown as CommittedAction[]
      const lastWeekPoints = priorActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
      const lastWeekTarget = pointsNeededForA(weekNumber - 1)
      const thisWeekTarget = pointsNeededForA(weekNumber)
      const completedLastWeek = actionLabels(priorActions.filter((a) => a.completed))
      const thisWeekPlan = actionLabels(currentSprint.committedActions as unknown as CommittedAction[]).slice(0, 5)

      const grade = await computeHireabilityGrade(candidate as CandidateWithGradeRelations)

      const result = await sendWeeklyGoalAssignedEmail(
        candidate,
        {
          lastWeekPoints,
          lastWeekTarget,
          thisWeekTarget,
          grade: grade.grade,
          weeklySprintsCount: weekNumber,
          laggingEngines: grade.laggingEngines,
          completedLastWeek,
          thisWeekPlan,
        },
        introCopy
      )
      if (result.sent) sentCount += 1
    } catch (error) {
      console.error('Morning Motivation failed for candidate', candidate.id, error)
    }
  }

  return { checked: eligible.length, sent: sentCount }
}
