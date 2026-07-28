import 'server-only'
import { prisma } from '@/lib/prisma'
import { VERIFIED_ACTION_TYPES } from '@/lib/weekly/action-effort'

interface ReconcilableAction {
  actionType?: string
  completed: boolean
  completedAt?: string
}

// Overrides the self-reported `completed`/`completedAt` on any action whose
// type is in VERIFIED_ACTION_TYPES with the real backing state — called from
// getCurrentWeekSprint so every consumer (grading, the dashboard card, the
// stats page) sees the same, ungameable truth without each needing its own
// fix. Actions of any other type pass through untouched.
export async function reconcileVerifiedActions<T extends ReconcilableAction>(
  candidateId: string,
  actions: T[]
): Promise<T[]> {
  const usedTypes = new Set(actions.map((a) => a.actionType).filter((t): t is string => !!t))
  const relevantTypes = [...usedTypes].filter((t) => VERIFIED_ACTION_TYPES.has(t))
  if (relevantTypes.length === 0) return actions

  const needsAssessmentCount = relevantTypes.includes('WORKING_STYLE_QUIZ')

  const [profile, assessmentResponseCount] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        profileConfirmedAt: true,
        industryConfirmedAt: true,
        functionConfirmedAt: true,
        salaryConfirmedAt: true,
        workAuthConfirmedAt: true,
        jobsAppliedBucket: true,
        interviewsReceivedCount: true,
        networkingLevel: true,
        learnedNewSkillsLevel: true,
        triedPartTimeOrConsulting: true,
        triedExecutiveCoaching: true,
        connectedWithRecruiters: true,
      },
    }),
    needsAssessmentCount
      ? prisma.candidateAssessmentResponse.count({ where: { candidateId } })
      : Promise.resolve(0),
  ])
  if (!profile) return actions

  const optionalQuestionsAnswered = [
    profile.jobsAppliedBucket,
    profile.interviewsReceivedCount,
    profile.networkingLevel,
    profile.learnedNewSkillsLevel,
    profile.triedPartTimeOrConsulting,
    profile.triedExecutiveCoaching,
    profile.connectedWithRecruiters,
  ].every((f) => f !== null)

  const verifiedCompletedAt: Partial<Record<string, Date | null>> = {
    PROFILE_CONFIRM: profile.profileConfirmedAt,
    INDUSTRY_CONFIRM: profile.industryConfirmedAt,
    FUNCTION_CONFIRM: profile.functionConfirmedAt,
    SALARY_CONFIRM: profile.salaryConfirmedAt,
    WORK_AUTHORIZATION: profile.workAuthConfirmedAt,
    WORKING_STYLE_QUIZ: assessmentResponseCount > 0 ? new Date() : null,
    ANSWER_OPTIONAL_QUESTIONS: optionalQuestionsAnswered ? new Date() : null,
  }

  return actions.map((action) => {
    if (!action.actionType || !VERIFIED_ACTION_TYPES.has(action.actionType)) return action
    const completedAt = verifiedCompletedAt[action.actionType] ?? null
    return { ...action, completed: !!completedAt, completedAt: completedAt?.toISOString() }
  })
}
