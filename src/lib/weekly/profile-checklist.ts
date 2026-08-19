import 'server-only'
import { prisma } from '@/lib/prisma'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import {
  PROFILE_CHECKLIST_ACTION_TYPES,
  PROFILE_CHECKLIST_LABEL_BY_TYPE,
  type ProfileChecklistActionType,
} from '@/lib/weekly/profile-checklist-types'

export { PROFILE_CHECKLIST_ACTION_TYPES, isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'
export type { ProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'

// Every truly one-time, lifetime profile/gate confirmation in the app —
// pulled out of the Weekly Search Sprint entirely (see sprint.ts and
// SuccessSprintCard.tsx) because mixing "confirm your industry" (5 pts) in
// the same list as "have a coffee chat" (30 pts) made the weekly checklist
// long and made unequal effort look equivalent. These all live on one
// dedicated page (/dashboard/complete-profile) instead, each still using
// its original gate component/server action — this file only aggregates
// their already-existing completion signals into one status. Deliberately
// excludes: GMAIL_CONNECTED/CALENDAR_CONNECTED (OAuth flows with their own
// connect/reconnect UI on Network/Jobs pages), INTERIM_PROFILE_CREATED
// (marketplace signup, not profile info), PARTNER_CLICK_THROUGH/
// WATCHLIST_* (click-tracking, repeatable), VISIBILITY_COMFORT_CHECKIN/
// MOOD_CHECKIN (weekly-reset bonuses, not lifetime one-time), and
// JOB_BOARD_USAGE_CONFIRMED (dead — no reachable UI sets it anymore).

export interface ProfileChecklistItem {
  actionType: ProfileChecklistActionType
  label: string
  points: number
  complete: boolean
  // When this item's completion timestamp is known — lets the Weekly
  // Search Sprint list keep a just-answered item visible (struck through)
  // for the rest of this week instead of dropping it the instant it's
  // done. Null for items with no discrete timestamp (see the three
  // exceptions in fetchCompletion below) — those keep the old
  // drop-immediately behavior.
  completedAt: Date | null
}

async function fetchCompletion(candidateId: string) {
  const [profile, assessmentResponseCount] = await Promise.all([
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        profileConfirmedAt: true,
        industryConfirmedAt: true,
        functionConfirmedAt: true,
        salaryConfirmedAt: true,
        workAuthConfirmedAt: true,
        networkingLevel: true,
        learnedNewSkillsLevel: true,
        triedPartTimeOrConsulting: true,
        triedExecutiveCoaching: true,
        connectedWithRecruiters: true,
        privacyOpenedUpBonusAt: true,
        comfortCheckBonusAt: true,
        networkComfortBonusAt: true,
        workSampleTypeBonusAt: true,
        contentUnlockBonusAt: true,
        gigDirectoryUnlockBonusAt: true,
        linkedinUnlockBonusAt: true,
        profilePictureUrl: true,
        linkedInConfirmedAt: true,
        skillsAssessmentCompletedAt: true,
        redFlagsBonusAt: true,
        benefitsPrioritiesBonusAt: true,
      },
    }),
    prisma.candidateAssessmentResponse.count({ where: { candidateId } }),
  ])
  if (!profile) return null

  const optionalQuestionsAnswered = [
    profile.networkingLevel,
    profile.learnedNewSkillsLevel,
    profile.triedPartTimeOrConsulting,
    profile.triedExecutiveCoaching,
    profile.connectedWithRecruiters,
  ].every((f) => f !== null)

  const completion: Record<ProfileChecklistActionType, boolean> = {
    WORKING_STYLE_QUIZ: assessmentResponseCount > 0,
    SKILLS_ASSESSMENT_COMPLETED: !!profile.skillsAssessmentCompletedAt,
    PROFILE_CONFIRM: !!profile.profileConfirmedAt,
    INDUSTRY_CONFIRM: !!profile.industryConfirmedAt,
    FUNCTION_CONFIRM: !!profile.functionConfirmedAt,
    SALARY_CONFIRM: !!profile.salaryConfirmedAt,
    WORK_AUTHORIZATION: !!profile.workAuthConfirmedAt,
    ANSWER_OPTIONAL_QUESTIONS: optionalQuestionsAnswered,
    PRIVACY_CONFIRMED: !!profile.privacyOpenedUpBonusAt,
    COMFORT_CHECK_CONFIRM: !!profile.comfortCheckBonusAt,
    NETWORK_COMFORT_CONFIRMED: !!profile.networkComfortBonusAt,
    WORK_SAMPLE_TYPE_CONFIRMED: !!profile.workSampleTypeBonusAt,
    MARKETING_PLAN_UNLOCK: !!profile.contentUnlockBonusAt,
    GIG_DIRECTORY_UNLOCK: !!profile.gigDirectoryUnlockBonusAt,
    LINKEDIN_UNLOCK: !!profile.linkedinUnlockBonusAt,
    // Live-checked against the field itself (not a separate one-time
    // timestamp) — removing the photo later correctly reverts this to
    // incomplete, same as it reverting the photo everywhere else it's shown.
    PROFILE_PICTURE_UPLOADED: !!profile.profilePictureUrl,
    // Confirmed either way — a candidate who explicitly says they don't
    // have a LinkedIn yet (see confirmLinkedIn's noLinkedIn checkbox) still
    // earns this, same as other confirm-type items reward answering the
    // question, not any particular answer.
    LINKEDIN_PROFILE_ADDED: !!profile.linkedInConfirmedAt,
    RED_FLAGS_CONFIRMED: !!profile.redFlagsBonusAt,
    BENEFITS_PRIORITIES_CONFIRMED: !!profile.benefitsPrioritiesBonusAt,
  }

  // Mirrors `completion` above, one-to-one, except for the three items with
  // no discrete timestamp field (WORKING_STYLE_QUIZ counts response rows,
  // ANSWER_OPTIONAL_QUESTIONS is derived from several fields at once,
  // PROFILE_PICTURE_UPLOADED is live-checked) — those stay null.
  const completedAt: Record<ProfileChecklistActionType, Date | null> = {
    WORKING_STYLE_QUIZ: null,
    SKILLS_ASSESSMENT_COMPLETED: profile.skillsAssessmentCompletedAt,
    PROFILE_CONFIRM: profile.profileConfirmedAt,
    INDUSTRY_CONFIRM: profile.industryConfirmedAt,
    FUNCTION_CONFIRM: profile.functionConfirmedAt,
    SALARY_CONFIRM: profile.salaryConfirmedAt,
    WORK_AUTHORIZATION: profile.workAuthConfirmedAt,
    ANSWER_OPTIONAL_QUESTIONS: null,
    PRIVACY_CONFIRMED: profile.privacyOpenedUpBonusAt,
    COMFORT_CHECK_CONFIRM: profile.comfortCheckBonusAt,
    NETWORK_COMFORT_CONFIRMED: profile.networkComfortBonusAt,
    WORK_SAMPLE_TYPE_CONFIRMED: profile.workSampleTypeBonusAt,
    MARKETING_PLAN_UNLOCK: profile.contentUnlockBonusAt,
    GIG_DIRECTORY_UNLOCK: profile.gigDirectoryUnlockBonusAt,
    LINKEDIN_UNLOCK: profile.linkedinUnlockBonusAt,
    PROFILE_PICTURE_UPLOADED: null,
    LINKEDIN_PROFILE_ADDED: profile.linkedInConfirmedAt,
    RED_FLAGS_CONFIRMED: profile.redFlagsBonusAt,
    BENEFITS_PRIORITIES_CONFIRMED: profile.benefitsPrioritiesBonusAt,
  }

  return { completion, completedAt }
}

// Full item list with labels/points/completion — used by the
// /dashboard/complete-profile page to decide what to render.
export async function getProfileChecklistItems(candidateId: string): Promise<ProfileChecklistItem[]> {
  const result = await fetchCompletion(candidateId)
  if (!result) return []
  const { completion, completedAt } = result
  return PROFILE_CHECKLIST_ACTION_TYPES.map((actionType) => ({
    actionType,
    label: PROFILE_CHECKLIST_LABEL_BY_TYPE[actionType],
    points: estimateActionEffort({ actionType }).points,
    complete: completion[actionType],
    completedAt: completedAt[actionType],
  }))
}
