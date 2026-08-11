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
  'RED_FLAGS_CONFIRMED',
  'BENEFITS_PRIORITIES_CONFIRMED',
] as const

export type ProfileChecklistActionType = (typeof PROFILE_CHECKLIST_ACTION_TYPES)[number]

// The label shown for each of these action types, wherever it appears —
// the checklist itself, the Weekly Sprint list, link-out cards. Single
// source of truth so a rename here reaches every surface; see
// canonical-labels.ts for why this matters for already-completed rows.
export const PROFILE_CHECKLIST_LABEL_BY_TYPE: Record<ProfileChecklistActionType, string> = {
  WORKING_STYLE_QUIZ: 'Take the Behavioral Assessment',
  SKILLS_ASSESSMENT_COMPLETED: 'Take the Skills Assessment',
  PROFILE_CONFIRM: 'Confirm your basic profile info',
  INDUSTRY_CONFIRM: 'Confirm your industry',
  FUNCTION_CONFIRM: 'Confirm your function & experience',
  SALARY_CONFIRM: 'Confirm your last salary',
  WORK_AUTHORIZATION: 'Confirm your work authorization',
  ANSWER_OPTIONAL_QUESTIONS: 'Complete your Search Strategy questions',
  PRIVACY_CONFIRMED: 'Choose your privacy setting',
  COMFORT_CHECK_CONFIRM: 'Complete your Interview Prep Comfort Check',
  NETWORK_COMFORT_CONFIRMED: 'Your networking comfort level',
  WORK_SAMPLE_TYPE_CONFIRMED: 'Provide Work Samples for Portfolio',
  MARKETING_PLAN_UNLOCK: 'Set up your Marketing Plan',
  GIG_DIRECTORY_UNLOCK: 'Unlock the Interim/Gig Directory',
  LINKEDIN_UNLOCK: 'Unlock the LinkedIn post generator',
  PROFILE_PICTURE_UPLOADED: 'Add a profile picture',
  LINKEDIN_PROFILE_ADDED: 'Add your LinkedIn profile',
  RED_FLAGS_CONFIRMED: 'Complete Screening Questions',
  BENEFITS_PRIORITIES_CONFIRMED: 'Set your benefits & compensation priorities',
}

const CHECKLIST_TYPE_SET = new Set<string>(PROFILE_CHECKLIST_ACTION_TYPES)

export function isProfileChecklistActionType(actionType: string | undefined): boolean {
  return !!actionType && CHECKLIST_TYPE_SET.has(actionType)
}
