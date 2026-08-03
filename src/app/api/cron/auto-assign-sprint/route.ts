import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getMondayOfWeek,
  getSuggestedActions,
  commitWeeklySprint,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { estimateActionEffort, pointsNeededForA } from '@/lib/weekly/action-effort'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { sendWeeklyGoalAssignedEmail } from '@/lib/email/send-weekly-goal-assigned'
import { captureServerEvent } from '@/lib/posthog/server'

// Fires Monday ~5am ET (fixed UTC time, see vercel.json — drifts an hour
// across the DST transition, accepted tradeoff over a wall-clock-exact
// check). Goal-setting is no longer a candidate action at all: every week's
// Search Actions are auto-assigned here, unconditionally, from the same
// suggestion engine the old manual "I Commit" flow used to surface. Right
// after assigning, sends the recap+preview email — skipped for anyone with
// no prior week to recap (their very first sprint, seeded separately by
// autoPopulateFirstSprint at Welcome-page time) or who's opted out.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())
  const priorMonday = new Date(weekStartDate)
  priorMonday.setUTCDate(priorMonday.getUTCDate() - 7)

  const eligible = await prisma.candidateProfile.findMany({
    where: { registrationCompletedAt: { not: null } },
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
      _count: { select: { weeklySprints: true } },
      coach: { select: { focus: true } },
    },
  })

  let autoAssigned = 0
  let emailsSent = 0
  for (const candidate of eligible) {
    try {
      const existing = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate } },
      })
      if (existing) continue

      const weekNumber = candidate._count.weeklySprints + 1

      // Captured before this week's row is created — "last week" only
      // exists if the candidate already had a sprint the week before.
      const priorSprint = await prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId: candidate.id, weekStartDate: priorMonday } },
      })

      const suggestedActions = await getSuggestedActions(candidate.id, weekNumber)
      if (suggestedActions.length === 0) continue

      const actions = suggestedActions.map((a) => {
        const effort = estimateActionEffort(a)
        return { text: a.text, actionType: a.actionType, points: effort.points, estimatedMinutes: effort.minutes }
      })
      await commitWeeklySprint(candidate.id, actions, true)
      autoAssigned += 1
      captureServerEvent(candidate.id, 'weekly_sprint_submitted', {
        weekNumber,
        actionCount: actions.length,
        committedPoints: actions.reduce((sum, a) => sum + a.points, 0),
        autoAssigned: true,
      })

      if (priorSprint && !candidate.weeklyReportOptedOut) {
        const priorActions = priorSprint.committedActions as unknown as CommittedAction[]
        const lastWeekPoints = priorActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
        const lastWeekTarget = pointsNeededForA(weekNumber - 1)
        const thisWeekTarget = pointsNeededForA(weekNumber)

        const grade = await computeHireabilityGrade(candidate as CandidateWithGradeRelations)

        const result = await sendWeeklyGoalAssignedEmail(candidate, {
          lastWeekPoints,
          lastWeekTarget,
          thisWeekTarget,
          grade: grade.grade,
          weeklySprintsCount: weekNumber,
          laggingEngines: grade.laggingEngines,
        })
        if (result.sent) emailsSent += 1
      }
    } catch (error) {
      console.error('Auto-assign sprint failed for candidate', candidate.id, error)
    }
  }

  return NextResponse.json({ checked: eligible.length, autoAssigned, emailsSent })
}
