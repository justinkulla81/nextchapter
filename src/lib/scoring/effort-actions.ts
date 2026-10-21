import { PROFILE_CHECKLIST_ACTION_TYPES } from '@/lib/weekly/profile-checklist-types'

// Which sprint actions count as search effort. Effort is what the Dossier and the
// unlocks show employers: how much work a member has put into actually getting a
// job. Answering questions about yourself, connecting an account, helping another
// member or clicking around is not that, and counting it let a member who only
// finished setup (up to 355 points) look most of the way to Candidate+ (480) and
// twice the way to the strategy unlock (180) before sending a single message.
//
// Only what is listed in EXCLUDED_FROM_EFFORT is left out. An untyped row (a
// personalised task from the plan or a coach) and any type not listed here still
// count, so retired or future types are not dropped silently; the test insists
// every point-earning type is placed in exactly one of the two lists below, so a
// new type has to be decided when it is added.

// Setup, profile, questionnaires, assessments and connecting accounts.
const SETUP: readonly string[] = [
  ...PROFILE_CHECKLIST_ACTION_TYPES,
  'GMAIL_CONNECTED',
  'GMAIL_RECONNECTED',
  'CALENDAR_CONNECTED',
  'CALENDAR_RECONNECTED',
  'SEARCH_STRATEGY_COMPLETE',
  'PERFORMANCE_ASSESSMENT_COMPLETED',
  'TRACK_RECORD_COMPLETED',
  'WHAT_I_NEED_COMPLETED',
  'WORK_INTERESTS_COMPLETED',
  'LINKEDIN_SETUP',
  'RESUME_BOOK_UPLOAD',
  'INTERIM_PROFILE_CREATED',
  'NEGOTIATION_INTERVIEW_COMFORT_CONFIRMED',
  'CONTACT_PRIORITIZED',
]

// A check-in, a click or a reaction: too light to stand for effort.
const CLICKS_AND_CHECK_INS: readonly string[] = [
  'MOOD_CHECKIN',
  'JOB_INTERESTED_REACTION',
  'PARTNER_CLICK_THROUGH',
  'WATCHLIST_ADD',
  'WATCHLIST_POSTING_VIEWED',
  'VIDEO_REACTION',
  'VIDEO_WATCHED',
  'JOB_BOARD_USAGE_CONFIRMED',
]

// Helping other members. Valuable to the community, but not the member's own search.
const COMMUNITY: readonly string[] = [
  'ENGAGE_COMMENT',
  'ENGAGE_EVENT',
  'ENGAGE_POST_UPDATE',
  'ENGAGE_PEER_SUPPORT',
  'INTEL_HELPFUL',
  'COMPANY_INTEL_CONTRIBUTED',
  'INSIDER_REQUEST_ANSWERED',
]

export const EXCLUDED_FROM_EFFORT: ReadonlySet<string> = new Set([...SETUP, ...CLICKS_AND_CHECK_INS, ...COMMUNITY])

// Outreach, follow-ups, applications, interviews, references, learning, work on
// the materials that get interviews, and the first work from a platform.
export const COUNTS_AS_EFFORT: ReadonlySet<string> = new Set([
  'CHECK_IN_NOTE_SENT',
  'CORE_NARRATIVE_COMPLETE',
  'COURSE_ENROLLED',
  'EMPLOYER_TAGGED',
  'FOLLOW_UP_NOTE_SENT',
  'HARD_QUESTIONS_COMPLETE',
  'INTERVIEW_ATTENDED',
  'INTERVIEW_BEHAVIORAL_PRACTICE',
  'INTERVIEW_PREP',
  'INTRO_CONNECTION_REQUEST_SENT',
  'JOB_APPLICATION_SUBMITTED',
  'LEARNING_CERTIFICATE',
  'LEARNING_CERTIFICATE_STARTED',
  'LEARNING_MODULE',
  'LEARNING_NEW_TOOL',
  'LEARNING_NEW_TOOL_STARTED',
  'LEARNING_SESSION_ATTENDED',
  'LINKEDIN_POST_IDEA',
  'NEGOTIATION_ADVICE',
  'NETWORKING_LIST',
  'OUTREACH_CALL',
  'OUTREACH_MESSAGE',
  'PITCH_PRACTICE_WITH_COACH',
  'PLATFORM_ACCEPTED',
  'PLATFORM_FIRST_PAYOUT',
  'PLATFORM_FIRST_PROJECT',
  'REFERENCE_ADDED',
  'REFERENCE_FOLLOW_UP',
  'REFERENCE_REQUESTED',
  'RESUME_UPDATE',
  'SHARE_NARRATIVE_FOR_FEEDBACK',
  'TAILORED_NARRATIVE_COMPLETE',
  'THANK_YOU_NOTE_SENT',
  'THOUGHT_LEADERSHIP_SHARE',
  'WAYS_TO_SAY_IT_COMPLETE',
])

// isGoalBonus is the one-time welcome and commitment credit: a bonus for saying
// yes, not effort.
export function countsAsSearchEffort(action: { actionType?: string; isGoalBonus?: boolean }): boolean {
  if (action.isGoalBonus) return false
  return !(action.actionType && EXCLUDED_FROM_EFFORT.has(action.actionType))
}
