import { PROFILE_CHECKLIST_ACTION_TYPES } from '@/lib/weekly/profile-checklist-types'

// Which sprint actions count as search effort, and how much. Effort is what the
// Dossier and the unlocks show employers: how much a member has put into getting
// a job. Counting everything let a member who only finished setup (up to 355
// points) look most of the way to Candidate+ (480) and twice the way to the
// strategy unlock (180) before sending a single message.
//
// Three kinds of action:
//   work        counts in full: outreach, applications, interviews, references,
//               learning, work on the materials that get interviews.
//   engagement  counts a little: showing up, browsing jobs, starring a contact,
//               joining the community, watching a video. A first step, so it earns
//               credit, but capped per week so it can never stand in for work.
//   none        does not count: setup, profile, assessments, connecting accounts,
//               the welcome bonus, and helping other members.
//
// Only EXCLUDED_FROM_EFFORT is dropped at runtime. An untyped row (a personalised
// task from the plan or a coach) and any type not listed here still counts as
// work, so retired or future types are not dropped silently; the test insists
// every point-earning type is placed in exactly one list, so a new type has to be
// decided when it is added.

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
  'LINKEDIN_SETUP',
  'RESUME_BOOK_UPLOAD',
  'NEGOTIATION_INTERVIEW_COMFORT_CONFIRMED',
]

// Helping other members. Valuable to the community, but not the member's own search.
const HELPING_OTHERS: readonly string[] = ['INTEL_HELPFUL', 'COMPANY_INTEL_CONTRIBUTED', 'INSIDER_REQUEST_ANSWERED']

// No screen sets this any more.
const RETIRED: readonly string[] = ['JOB_BOARD_USAGE_CONFIRMED']

export const EXCLUDED_FROM_EFFORT: ReadonlySet<string> = new Set([...SETUP, ...HELPING_OTHERS, ...RETIRED])

// Light engagement across the four places a member works on their search.
export const ENGAGEMENT_ACTION_TYPES: ReadonlySet<string> = new Set([
  // Showing up
  'LOGIN_VISIT',
  'MOOD_CHECKIN',
  // Jobs
  'JOB_INTERESTED_REACTION',
  'WATCHLIST_ADD',
  'WATCHLIST_POSTING_VIEWED',
  'PARTNER_CLICK_THROUGH',
  // Networking
  'CONTACT_PRIORITIZED',
  'ENGAGE_COMMENT',
  'ENGAGE_EVENT',
  'ENGAGE_POST_UPDATE',
  'ENGAGE_PEER_SUPPORT',
  // Registering for a conference is a first step; the proposal and the talk are work.
  'CONFERENCE_REGISTER',
  // Fractional and interim work
  'INTERIM_PROFILE_CREATED',
  // Learning
  'VIDEO_WATCHED',
  'VIDEO_REACTION',
])

// The most engagement can add in one weekly sprint. Small on purpose: at 10 a week
// it would take most of a year of only showing up to reach the 480-minute bar.
export const ENGAGEMENT_MINUTES_PER_WEEK_CAP = 10

// Outreach, follow-ups, applications, interviews, references, learning, work on
// the materials that get interviews, and the first work from a platform.
export const COUNTS_AS_EFFORT: ReadonlySet<string> = new Set([
  'CHECK_IN_NOTE_SENT',
  'CONFERENCE_SUBMISSION',
  'CONFERENCE_TALK',
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

export type EffortKind = 'work' | 'engagement' | 'none'

// isGoalBonus is the one-time welcome and commitment credit: a bonus for saying
// yes, not effort.
export function effortKind(action: { actionType?: string; isGoalBonus?: boolean }): EffortKind {
  if (action.isGoalBonus) return 'none'
  if (!action.actionType) return 'work'
  if (EXCLUDED_FROM_EFFORT.has(action.actionType)) return 'none'
  if (ENGAGEMENT_ACTION_TYPES.has(action.actionType)) return 'engagement'
  return 'work'
}
