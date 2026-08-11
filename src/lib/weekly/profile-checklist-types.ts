// Client-safe half of profile-checklist.ts — just the type list and a pure
// membership check, split out so SuccessSprintCard.tsx (a client component)
// can filter these action types out of its rendered list without pulling
// in the server-only DB-querying half of that file.
export const PROFILE_CHECKLIST_ACTION_TYPES = [
  'WORKING_STYLE_QUIZ',
  'SKILLS_ASSESSMENT_COMPLETED',
  'PROFILE_CONFIRM',
  'INDUSTRY_CONFIRM',
  'FUNCTION_CONFIRM',
  'SALARY_CONFIRM',
  'WORK_AUTHORIZATION',
  'ANSWER_OPTIONAL_QUESTIONS',
  'PRIVACY_CONFIRMED',
  'COMFORT_CHECK_CONFIRM',
  'NETWORK_COMFORT_CONFIRMED',
  'WORK_SAMPLE_TYPE_CONFIRMED',
  'MARKETING_PLAN_UNLOCK',
  'GIG_DIRECTORY_UNLOCK',
  'LINKEDIN_UNLOCK',
  'PROFILE_PICTURE_UPLOADED',
  'LINKEDIN_PROFILE_ADDED',
] as const

export type ProfileChecklistActionType = (typeof PROFILE_CHECKLIST_ACTION_TYPES)[number]

const CHECKLIST_TYPE_SET = new Set<string>(PROFILE_CHECKLIST_ACTION_TYPES)

export function isProfileChecklistActionType(actionType: string | undefined): boolean {
  return !!actionType && CHECKLIST_TYPE_SET.has(actionType)
}
