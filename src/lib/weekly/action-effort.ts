// Weekly Search Score points model — 1 point = 1 minute of real effort,
// exactly as documented to candidates in the FAQ/Glossary. Every Search
// Action has a fixed point value; nothing is estimated or judgment-weighted
// anymore.

import type { PageKey } from '@/lib/dashboard/page-content'

export interface SuggestedActionLike {
  actionType?: string
  isAStandard?: boolean
  isStretch?: boolean
}

export interface ActionEffort {
  minutes: number
  points: number
}

// The canonical Search Action point table. Keys map onto the six
// engines (Outreach, Engage, Thought Leadership, Learning,
// Resume/Assets, Interview Prep) plus one-time setup items. 1 point = 1
// minute in every row here — keep it that way when adding new task types.
const ACTION_TYPE_EFFORT: Partial<Record<string, ActionEffort>> = {
  // Outreach
  OUTREACH_MESSAGE: { minutes: 15, points: 15 },
  OUTREACH_CALL: { minutes: 30, points: 30 },
  NETWORKING_LIST: { minutes: 25, points: 25 },

  // Engage (Support Network) — Peer Support is intentionally 0, see below.
  ENGAGE_COMMENT: { minutes: 5, points: 5 },
  ENGAGE_EVENT: { minutes: 30, points: 30 },
  ENGAGE_POST_UPDATE: { minutes: 10, points: 10 },
  ENGAGE_PEER_SUPPORT: { minutes: 0, points: 0 },

  // Thought Leadership
  LINKEDIN_POST_IDEA: { minutes: 20, points: 20 },
  THOUGHT_LEADERSHIP_SHARE: { minutes: 10, points: 10 },

  // Learning
  LEARNING_MODULE: { minutes: 20, points: 20 },
  // Split into a small "started" click (self-reported, no verification —
  // real risk of "earn 40 pts for saying you did it" with a single click)
  // and a separate "complete" step below, only ever suggested once started
  // is on record (see getSuggestedActions in sprint.ts). Same split for
  // LEARNING_NEW_TOOL.
  LEARNING_CERTIFICATE_STARTED: { minutes: 3, points: 5 },
  LEARNING_CERTIFICATE: { minutes: 40, points: 40 },
  LEARNING_NEW_TOOL_STARTED: { minutes: 3, points: 5 },
  LEARNING_NEW_TOOL: { minutes: 15, points: 15 },
  // Calendar-detected — a scheduled course/webinar/training block that
  // actually happened. Same weight as LEARNING_MODULE, the closest
  // self-report equivalent.
  LEARNING_SESSION_ATTENDED: { minutes: 30, points: 20 },

  // Resume / Assets
  RESUME_UPDATE: { minutes: 30, points: 30 },
  SKILLS_TRANSLATOR: { minutes: 15, points: 15 },
  LINKEDIN_SETUP: { minutes: 20, points: 20 },

  // Interview Prep
  INTERVIEW_PREP: { minutes: 30, points: 30 },
  INTERVIEW_BEHAVIORAL_PRACTICE: { minutes: 15, points: 15 },
  NEGOTIATION_ADVICE: { minutes: 20, points: 20 },

  // One-time items
  WORKING_STYLE_QUIZ: { minutes: 25, points: 25 },
  SKILLS_ASSESSMENT_COMPLETED: { minutes: 15, points: 20 },

  // Prompt 68 — Interim Work page. Signing up for a fractional/talent
  // marketplace is a real, if small, step; deliberately smaller than
  // REFERENCE_ADDED/WORKING_STYLE_QUIZ since it's self-reported with no
  // verification, same reasoning as the other self-report action types.
  INTERIM_PROFILE_CREATED: { minutes: 10, points: 10 },

  // Prompt 70 — observability retrofit. A tracked click-through to an
  // outbound partner link (Interim Work, job board recommendations) is
  // real signal, but deliberately much smaller than profile-creation
  // (INTERIM_PROFILE_CREATED, 10pts) or placement-logging (REFERENCE_ADDED,
  // 30pts) — a click costs nothing and proves nothing beyond "looked at
  // it," so it shouldn't earn comparable credit. Capped once per
  // candidate/partner/day at the DB layer (PartnerClickThrough unique
  // constraint), not just here.
  PARTNER_CLICK_THROUGH: { minutes: 2, points: 2 },

  // Prompt 77 — Company Tracker. Same click-through weight as
  // PARTNER_CLICK_THROUGH above: naming a target company or opening a
  // posting you were notified about costs nothing and proves nothing
  // beyond "looked at it."
  WATCHLIST_ADD: { minutes: 2, points: 2 },
  WATCHLIST_POSTING_VIEWED: { minutes: 2, points: 2 },

  // Requesting a reference — real placement-logging, weighted close to
  // RESUME_UPDATE/NETWORKING_LIST for a comparable time cost (finding the
  // right person, writing a real ask, not just clicking a button).
  REFERENCE_ADDED: { minutes: 20, points: 30 },

  // Applying itself — wherever the posting actually came from (LinkedIn,
  // Indeed, a company site) — is the real job-search work; this fires when
  // a candidate marks a tracked posting Applied, same weight as
  // NETWORKING_LIST/RESUME_UPDATE for a comparable real-world time cost.
  JOB_APPLICATION_SUBMITTED: { minutes: 25, points: 25 },
  // Reacting "Interested" to a surfaced/board posting is a single click,
  // not real search work yet — same weight as WATCHLIST_POSTING_VIEWED.
  JOB_INTERESTED_REACTION: { minutes: 2, points: 2 },

  // Profile picture — small one-time bonus, same weight as the other
  // one-time confirms. Live-checked against profilePictureUrl (see
  // profile-checklist.ts) rather than a separate timestamp, so removing the
  // photo later correctly reverts it to incomplete.
  PROFILE_PICTURE_UPLOADED: { minutes: 3, points: 5 },
  // Weighted well above the other one-time confirms — a real LinkedIn URL
  // (or an explicit "I don't have one yet") on file matters for recruiter
  // visibility and is referenced directly in the Hireability Report and
  // Victoria's replies, unlike most other profile confirms.
  LINKEDIN_PROFILE_ADDED: { minutes: 10, points: 25 },

  // Prompt 76 — Gmail activity tracking. One-time connection bonus, same
  // weight as other one-time confirm bonuses. The four Sent-folder
  // categories are real, distinct networking actions — never merged into
  // one "outreach" bucket — with INTRO_CONNECTION_REQUEST weighted higher
  // since asking for an introduction is a more substantive ask than a
  // routine note.
  GMAIL_CONNECTED: { minutes: 5, points: 10 },
  // Smaller one-time bonus for reconnecting after a testing-mode token
  // expiry — real (keeps auto-detected tracking working again) but a
  // smaller ask than the original connect, since it's just re-authorizing.
  GMAIL_RECONNECTED: { minutes: 3, points: 5 },
  THANK_YOU_NOTE_SENT: { minutes: 10, points: 10 },
  FOLLOW_UP_NOTE_SENT: { minutes: 10, points: 10 },
  CHECK_IN_NOTE_SENT: { minutes: 10, points: 10 },
  INTRO_CONNECTION_REQUEST_SENT: { minutes: 15, points: 15 },

  // Prompt 79 — Calendar Connect. Same one-time connection bonus as Gmail.
  // INTERVIEW_ATTENDED is a real, high-value signal detected passively (no
  // active-prep credit here — that's INTERVIEW_PREP's job) so it's weighted
  // below that but above a routine outreach call. Detected networking calls
  // reuse the existing OUTREACH_CALL type rather than adding a parallel one.
  CALENDAR_CONNECTED: { minutes: 5, points: 10 },
  // Same reconnect-bonus reasoning as GMAIL_RECONNECTED above.
  CALENDAR_RECONNECTED: { minutes: 3, points: 5 },
  INTERVIEW_ATTENDED: { minutes: 30, points: 25 },

  // Onboarding confirmations — small, real setup steps.
  PROFILE_CONFIRM: { minutes: 5, points: 5 },
  INDUSTRY_CONFIRM: { minutes: 5, points: 5 },
  FUNCTION_CONFIRM: { minutes: 5, points: 5 },
  SALARY_CONFIRM: { minutes: 5, points: 5 },
  WORK_AUTHORIZATION: { minutes: 5, points: 5 },
  ANSWER_OPTIONAL_QUESTIONS: { minutes: 2, points: 5 },

  // One-time bonus for confirming ANY explicit privacy tier choice — same
  // point value as the other one-time confirm bonuses above. Separate from
  // (and much smaller than) the recurring per-week connecting-engine bump
  // that Public/Semi-Public specifically earns in computeWeeklyEngines.
  PRIVACY_CONFIRMED: { minutes: 5, points: 5 },
  JOB_BOARD_USAGE_CONFIRMED: { minutes: 3, points: 5 },
  // One-time Interview Prep Comfort Check — same weight as the other
  // one-time confirms, and the unlock gate for INTERVIEW_BEHAVIORAL_PRACTICE.
  COMFORT_CHECK_CONFIRM: { minutes: 3, points: 5 },

  // Weekly (not lifetime) re-check of visibility comfort, prompted by
  // VisibilityComfortCard on the dashboard — same small confirm-bonus
  // weight as PRIVACY_CONFIRMED above, awarded once per week since it's
  // injected into that week's committedActions, which resets every week.
  VISIBILITY_COMFORT_CHECKIN: { minutes: 5, points: 5 },

  // Daily mood check-in — small recurring bonus, same weekly-reset shape as
  // VISIBILITY_COMFORT_CHECKIN above (awarded once per week, the first time
  // that week's check-in happens, via autoCompleteEngagementAction).
  MOOD_CHECKIN: { minutes: 2, points: 3 },

  // One-time unlock-gate bonuses — every gate that unlocks a whole section
  // gets the same small, clearly-labeled one-time award as the confirms
  // above, so "answer this to unlock X" never feels like unpaid setup work.
  MARKETING_PLAN_UNLOCK: { minutes: 3, points: 5 },
  GIG_DIRECTORY_UNLOCK: { minutes: 3, points: 5 },
  LINKEDIN_UNLOCK: { minutes: 3, points: 5 },
  WORK_SAMPLE_TYPE_CONFIRMED: { minutes: 3, points: 5 },
  NETWORK_COMFORT_CONFIRMED: { minutes: 3, points: 5 },
}

const DEFAULT_EFFORT: ActionEffort = { minutes: 15, points: 15 }

export function estimateActionEffort(action: SuggestedActionLike): ActionEffort {
  if (action.actionType && ACTION_TYPE_EFFORT[action.actionType]) {
    return ACTION_TYPE_EFFORT[action.actionType]!
  }
  return DEFAULT_EFFORT
}

// Which of the four dashboard engines (learning / effort / working /
// connecting) each action type's points count toward — used to give the
// engine breakdown real weekly signal instead of a static profile-state
// proxy. Grouping chosen to match each engine's existing explanation text:
// Learning = learning tasks; Working = visible produced assets/content;
// Connecting = network + community signals; Effort = interview prep + the
// one-time setup work that gets a search actually running.
export type SearchExecutionEngineKey = 'learning' | 'effort' | 'working' | 'connecting'

const ENGINE_BY_ACTION_TYPE: Record<string, SearchExecutionEngineKey> = {
  OUTREACH_MESSAGE: 'connecting',
  OUTREACH_CALL: 'connecting',
  NETWORKING_LIST: 'connecting',
  ENGAGE_COMMENT: 'connecting',
  ENGAGE_EVENT: 'connecting',
  ENGAGE_POST_UPDATE: 'connecting',
  ENGAGE_PEER_SUPPORT: 'connecting',

  LINKEDIN_POST_IDEA: 'working',
  THOUGHT_LEADERSHIP_SHARE: 'working',
  RESUME_UPDATE: 'working',
  SKILLS_TRANSLATOR: 'working',
  LINKEDIN_SETUP: 'working',

  LEARNING_MODULE: 'learning',
  LEARNING_CERTIFICATE_STARTED: 'learning',
  LEARNING_CERTIFICATE: 'learning',
  LEARNING_NEW_TOOL_STARTED: 'learning',
  LEARNING_NEW_TOOL: 'learning',
  LEARNING_SESSION_ATTENDED: 'learning',

  INTERVIEW_PREP: 'effort',
  INTERVIEW_BEHAVIORAL_PRACTICE: 'effort',
  NEGOTIATION_ADVICE: 'effort',
  ASSESSMENT_COMPLETE: 'effort',
  WORKING_STYLE_QUIZ: 'effort',
  SKILLS_ASSESSMENT_COMPLETED: 'effort',
  REFERENCE_ADDED: 'effort',
  RESUME_BOOK_UPLOAD: 'effort',
  PROFILE_CONFIRM: 'effort',
  INDUSTRY_CONFIRM: 'effort',
  FUNCTION_CONFIRM: 'effort',
  SALARY_CONFIRM: 'effort',
  WORK_AUTHORIZATION: 'effort',
  ANSWER_OPTIONAL_QUESTIONS: 'effort',
  INTERIM_PROFILE_CREATED: 'connecting',
  PARTNER_CLICK_THROUGH: 'connecting',
  WATCHLIST_ADD: 'connecting',
  WATCHLIST_POSTING_VIEWED: 'connecting',
  JOB_APPLICATION_SUBMITTED: 'effort',
  JOB_INTERESTED_REACTION: 'connecting',
  PROFILE_PICTURE_UPLOADED: 'connecting',
  GMAIL_CONNECTED: 'connecting',
  GMAIL_RECONNECTED: 'connecting',
  THANK_YOU_NOTE_SENT: 'connecting',
  FOLLOW_UP_NOTE_SENT: 'connecting',
  CHECK_IN_NOTE_SENT: 'connecting',
  INTRO_CONNECTION_REQUEST_SENT: 'connecting',
  CALENDAR_CONNECTED: 'connecting',
  CALENDAR_RECONNECTED: 'connecting',
  INTERVIEW_ATTENDED: 'effort',
  PRIVACY_CONFIRMED: 'connecting',
  JOB_BOARD_USAGE_CONFIRMED: 'effort',
  COMFORT_CHECK_CONFIRM: 'effort',
  VISIBILITY_COMFORT_CHECKIN: 'connecting',
  MOOD_CHECKIN: 'connecting',
  MARKETING_PLAN_UNLOCK: 'working',
  GIG_DIRECTORY_UNLOCK: 'connecting',
  LINKEDIN_UNLOCK: 'working',
  WORK_SAMPLE_TYPE_CONFIRMED: 'working',
  NETWORK_COMFORT_CONFIRMED: 'connecting',
  LINKEDIN_PROFILE_ADDED: 'working',
}

export function engineForActionType(actionType: string | undefined): SearchExecutionEngineKey {
  if (actionType && ENGINE_BY_ACTION_TYPE[actionType]) return ENGINE_BY_ACTION_TYPE[actionType]
  return 'effort'
}

// Which top-level Sprint section each action type's real work happens
// under — a separate axis from the four scoring engines above (engine =
// what it counts toward, nav category = where you'd actually go do it).
// Kept as its own map rather than derived from ACTION_TYPE_LINK's href so
// it stays correct even for action types with no deep link. "Personalize"
// is lifetime one-time setup (profile/gate confirms, connecting Gmail &
// Calendar) — deliberately excluded from the weekly point-pace math (see
// SuccessSprintCard's oneTimeTotal/oneTimeDone), same as it always was when
// this lived on a separate /dashboard/complete-profile page; only its
// on-screen location changed.
export type NavCategory = 'Personalize' | 'Building' | 'Connecting' | 'Learning & Working'

const NAV_CATEGORY_BY_ACTION_TYPE: Partial<Record<string, NavCategory>> = {
  // Display-only sentinel for the Search Strategy completeness checklist
  // (see search-strategy-checklist.ts) — deliberately absent from
  // ACTION_TYPE_EFFORT/PAGE_ACTION_TYPES so it never enters the Sprint
  // grading economy; this map and ACTION_TYPE_LINK below are purely
  // presentational (which nav group a row sorts into, where it links).
  SEARCH_STRATEGY_CHECKLIST: 'Personalize',
  WORKING_STYLE_QUIZ: 'Personalize',
  SKILLS_ASSESSMENT_COMPLETED: 'Personalize',
  PROFILE_CONFIRM: 'Personalize',
  INDUSTRY_CONFIRM: 'Personalize',
  FUNCTION_CONFIRM: 'Personalize',
  SALARY_CONFIRM: 'Personalize',
  WORK_AUTHORIZATION: 'Personalize',
  ANSWER_OPTIONAL_QUESTIONS: 'Personalize',
  COMFORT_CHECK_CONFIRM: 'Personalize',
  PRIVACY_CONFIRMED: 'Personalize',
  NETWORK_COMFORT_CONFIRMED: 'Personalize',
  WORK_SAMPLE_TYPE_CONFIRMED: 'Personalize',
  MARKETING_PLAN_UNLOCK: 'Personalize',
  GIG_DIRECTORY_UNLOCK: 'Personalize',
  LINKEDIN_UNLOCK: 'Personalize',
  PROFILE_PICTURE_UPLOADED: 'Personalize',
  LINKEDIN_PROFILE_ADDED: 'Personalize',
  GMAIL_CONNECTED: 'Personalize',
  GMAIL_RECONNECTED: 'Personalize',
  CALENDAR_CONNECTED: 'Personalize',
  CALENDAR_RECONNECTED: 'Personalize',

  RESUME_UPDATE: 'Building',
  SKILLS_TRANSLATOR: 'Building',
  INTERVIEW_PREP: 'Building',
  INTERVIEW_BEHAVIORAL_PRACTICE: 'Building',
  LINKEDIN_POST_IDEA: 'Building',
  THOUGHT_LEADERSHIP_SHARE: 'Building',
  LINKEDIN_SETUP: 'Building',

  NETWORKING_LIST: 'Connecting',
  OUTREACH_MESSAGE: 'Connecting',
  OUTREACH_CALL: 'Connecting',
  REFERENCE_ADDED: 'Connecting',
  ENGAGE_COMMENT: 'Connecting',
  ENGAGE_EVENT: 'Connecting',
  ENGAGE_POST_UPDATE: 'Connecting',
  ENGAGE_PEER_SUPPORT: 'Connecting',
  MOOD_CHECKIN: 'Connecting',
  VISIBILITY_COMFORT_CHECKIN: 'Connecting',
  THANK_YOU_NOTE_SENT: 'Connecting',
  FOLLOW_UP_NOTE_SENT: 'Connecting',
  CHECK_IN_NOTE_SENT: 'Connecting',
  INTRO_CONNECTION_REQUEST_SENT: 'Connecting',
  INTERVIEW_ATTENDED: 'Connecting',

  LEARNING_MODULE: 'Learning & Working',
  LEARNING_CERTIFICATE_STARTED: 'Learning & Working',
  LEARNING_CERTIFICATE: 'Learning & Working',
  LEARNING_NEW_TOOL_STARTED: 'Learning & Working',
  LEARNING_NEW_TOOL: 'Learning & Working',
  LEARNING_SESSION_ATTENDED: 'Learning & Working',
  NEGOTIATION_ADVICE: 'Learning & Working',
  JOB_BOARD_USAGE_CONFIRMED: 'Learning & Working',
  INTERIM_PROFILE_CREATED: 'Learning & Working',
  PARTNER_CLICK_THROUGH: 'Learning & Working',
  WATCHLIST_ADD: 'Learning & Working',
  WATCHLIST_POSTING_VIEWED: 'Learning & Working',
  JOB_APPLICATION_SUBMITTED: 'Learning & Working',
  JOB_INTERESTED_REACTION: 'Learning & Working',
}

export function navCategoryForActionType(actionType: string | undefined): NavCategory | undefined {
  return actionType ? NAV_CATEGORY_BY_ACTION_TYPE[actionType] : undefined
}

// Recurring action types represent an ongoing habit you can engage with
// repeatedly through the week (send another outreach message, comment on
// another post) — there's no single finish line, so they get a one-way
// "Started" state instead of a completable checkbox. Everything not listed
// here is one-time: a discrete task with a real finish line (update your
// resume, take the Working Style Quiz) that gets a true Mark done toggle.
const RECURRING_ACTION_TYPES = new Set<string>([
  'OUTREACH_MESSAGE',
  'OUTREACH_CALL',
  // Accrues from a CSV-import event (new contacts detected), same
  // "recurring, no single finish line" shape as the Gmail/Calendar-detected
  // types below — not a candidate-chosen weekly rep count, see
  // RECURRING_ACTION_TARGET_COUNT's comment.
  'NETWORKING_LIST',
  'ENGAGE_COMMENT',
  'ENGAGE_EVENT',
  'ENGAGE_POST_UPDATE',
  'ENGAGE_PEER_SUPPORT',
  'LINKEDIN_POST_IDEA',
  'THOUGHT_LEADERSHIP_SHARE',
  'INTERVIEW_BEHAVIORAL_PRACTICE',
  // Prompt 76 — a candidate can send more than one thank-you/follow-up/
  // check-in/intro-request in a week; each detected instance earns points
  // again, same as sending another outreach message.
  'THANK_YOU_NOTE_SENT',
  'FOLLOW_UP_NOTE_SENT',
  'CHECK_IN_NOTE_SENT',
  'INTRO_CONNECTION_REQUEST_SENT',
  'INTERVIEW_ATTENDED',
  // Prompt: calendar body/context classification — a candidate can attend
  // more than one scheduled learning session in a week, same "no single
  // finish line" shape as the other calendar-detected types above.
  'LEARNING_SESSION_ATTENDED',
  // Prompt 77 — Company Tracker. Adding another company is the same
  // "ongoing habit, no single finish line" shape as the rest of this set.
  'WATCHLIST_ADD',
  // A candidate can add more than one reference over the course of a
  // search — same "ongoing habit, no single finish line" shape as the rest
  // of this set.
  'REFERENCE_ADDED',
  // Job searching itself has no single finish line either — you look for
  // full-time jobs again next week, same shape as the rest of this set.
  'JOB_BOARD_USAGE_CONFIRMED',
  // Applying to jobs and reacting to new matches are both ongoing —
  // there's always another posting next week, same shape as the rest of
  // this set.
  'JOB_APPLICATION_SUBMITTED',
  'JOB_INTERESTED_REACTION',
])

export function isRecurringActionType(actionType: string | undefined): boolean {
  return !!actionType && RECURRING_ACTION_TYPES.has(actionType)
}

// A suggested rep count per week for every recurring type — lets the
// dashboard show real progress ("1 of 2 this week") instead of a bare point
// value, so the target reads as a concrete number of real-world actions,
// not just an abstract score. For the passively-detected types
// (THANK_YOU_NOTE_SENT, FOLLOW_UP_NOTE_SENT, CHECK_IN_NOTE_SENT,
// INTRO_CONNECTION_REQUEST_SENT, INTERVIEW_ATTENDED, NETWORKING_LIST,
// LEARNING_SESSION_ATTENDED) the count is a display goal only — it doesn't
// gate anything, since those accrue from Gmail/Calendar/CSV detection, not
// a candidate-picked commitment. Starting defaults, tuned to land near
// typical weekly point targets — adjust freely per type.
const RECURRING_ACTION_TARGET_COUNT: Partial<Record<string, number>> = {
  OUTREACH_MESSAGE: 2,
  OUTREACH_CALL: 1,
  NETWORKING_LIST: 1,
  REFERENCE_ADDED: 1,
  ENGAGE_COMMENT: 3,
  ENGAGE_EVENT: 1,
  ENGAGE_POST_UPDATE: 1,
  ENGAGE_PEER_SUPPORT: 1,
  LINKEDIN_POST_IDEA: 1,
  THOUGHT_LEADERSHIP_SHARE: 2,
  INTERVIEW_BEHAVIORAL_PRACTICE: 2,
  THANK_YOU_NOTE_SENT: 1,
  FOLLOW_UP_NOTE_SENT: 1,
  CHECK_IN_NOTE_SENT: 1,
  INTRO_CONNECTION_REQUEST_SENT: 1,
  INTERVIEW_ATTENDED: 1,
  LEARNING_SESSION_ATTENDED: 1,
  WATCHLIST_ADD: 3,
  JOB_BOARD_USAGE_CONFIRMED: 3,
  JOB_APPLICATION_SUBMITTED: 3,
  JOB_INTERESTED_REACTION: 3,
}

export function getRecurringTargetCount(actionType: string | undefined): number | null {
  if (!actionType) return null
  return RECURRING_ACTION_TARGET_COUNT[actionType] ?? null
}

// Action types whose "done" state is derived from real backing data instead
// of the self-reported completed flag in the committed-actions JSON blob —
// see reconcileVerifiedActions in action-verification.ts, which does the
// actual DB-backed reconciliation. This Set lives here (not there) because
// it's also needed client-side, to hide the Mark done/started button for
// these types — action-verification.ts is server-only.
export const VERIFIED_ACTION_TYPES = new Set<string>([
  'PROFILE_CONFIRM',
  'INDUSTRY_CONFIRM',
  'FUNCTION_CONFIRM',
  'SALARY_CONFIRM',
  'WORK_AUTHORIZATION',
  'WORKING_STYLE_QUIZ',
  'SKILLS_ASSESSMENT_COMPLETED',
  'ANSWER_OPTIONAL_QUESTIONS',
  'COMFORT_CHECK_CONFIRM',
])

export function isVerifiedActionType(actionType: string | undefined): boolean {
  return !!actionType && VERIFIED_ACTION_TYPES.has(actionType)
}

// Action types with a real detector elsewhere in the app — Gmail sync,
// Calendar sync, CSV import, or a genuine feature click on the page itself
// (applying to a tracked posting, reacting to a recommendation, adding a
// company to the tracker) — distinct from VERIFIED_ACTION_TYPES above,
// which feeds reconcileVerifiedActions's DB-column override for an
// unrelated set of onboarding confirms. This Set exists so
// SprintActionCompletion can render a plain status readout instead of a
// self-report "Mark done" button for anything the app can already verify —
// no self-report, no partial-trust fallback, for any candidate, per the
// product rule that a self-report click is not evidence.
export const AUTO_DETECTED_ACTION_TYPES = new Set<string>([
  'OUTREACH_MESSAGE',
  'OUTREACH_CALL',
  'NETWORKING_LIST',
  'REFERENCE_ADDED',
  'FOLLOW_UP_NOTE_SENT',
  'THANK_YOU_NOTE_SENT',
  'CHECK_IN_NOTE_SENT',
  'INTRO_CONNECTION_REQUEST_SENT',
  'INTERVIEW_ATTENDED',
  'LEARNING_SESSION_ATTENDED',
  // Verified via markApplied/reactToSurfacedJob/the Company Tracker form —
  // see autoCompleteEngagementAction's call sites in find-my-job/actions.ts
  // and company-tracker/actions.ts.
  'JOB_APPLICATION_SUBMITTED',
  'JOB_INTERESTED_REACTION',
  'WATCHLIST_ADD',
  // Verified via requestPracticeEvaluation/requestToughAnswerFeedback in
  // interview-prep/actions.ts — a candidate answering a real practice or
  // tough question is the actual "mock interview" work; a self-report
  // "Mark done" click on this bullet was not evidence of that.
  'INTERVIEW_PREP',
])

export function isAutoDetectedActionType(actionType: string | undefined): boolean {
  return !!actionType && AUTO_DETECTED_ACTION_TYPES.has(actionType)
}

// Where each action type's real work actually happens — used to make
// committed Sprint items click through to the page where you do the work,
// instead of just toggling a checkbox in place.
export const ACTION_TYPE_LINK: Partial<Record<string, { href: string; label: string }>> = {
  SEARCH_STRATEGY_CHECKLIST: { href: '/dashboard/search-strategy', label: 'Search Strategy' },
  NETWORKING_LIST: { href: '/dashboard/network#import', label: 'My Network' },
  OUTREACH_MESSAGE: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_CALL: { href: '/dashboard/network', label: 'My Network' },
  REFERENCE_ADDED: { href: '/dashboard/references', label: 'My References' },
  ENGAGE_COMMENT: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_EVENT: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_POST_UPDATE: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_PEER_SUPPORT: { href: '/dashboard/community', label: 'Support Network' },
  LINKEDIN_SETUP: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  LINKEDIN_POST_IDEA: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  THOUGHT_LEADERSHIP_SHARE: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  LEARNING_MODULE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_CERTIFICATE_STARTED: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_CERTIFICATE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_NEW_TOOL_STARTED: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_NEW_TOOL: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_SESSION_ATTENDED: { href: '/dashboard/learning', label: 'Learning' },
  RESUME_UPDATE: { href: '/dashboard/resume', label: 'Resume' },
  SKILLS_TRANSLATOR: { href: '/dashboard/resume', label: 'Resume' },
  INTERVIEW_PREP: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  INTERVIEW_BEHAVIORAL_PRACTICE: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  NEGOTIATION_ADVICE: { href: '/dashboard/find-my-job#jobs-applied', label: 'Find My Job' },
  // Hash anchors so clicking a profile task lands scrolled to that exact
  // section instead of the top of a long page — see the matching `id`s on
  // each Card in src/app/dashboard/profile/page.tsx.
  PROFILE_CONFIRM: { href: '/dashboard/profile#basics', label: 'Profile' },
  INDUSTRY_CONFIRM: { href: '/dashboard/profile#industry', label: 'Profile' },
  FUNCTION_CONFIRM: { href: '/dashboard/profile#function-experience', label: 'Profile' },
  SALARY_CONFIRM: { href: '/dashboard/profile#salary', label: 'Profile' },
  WORK_AUTHORIZATION: { href: '/dashboard/profile#work-authorization', label: 'Profile' },
  WORKING_STYLE_QUIZ: { href: '/dashboard/retake-assessment', label: 'How I Work Best' },
  SKILLS_ASSESSMENT_COMPLETED: { href: '/dashboard/skills-assessment', label: 'Skills Assessment' },
  COMFORT_CHECK_CONFIRM: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  INTERIM_PROFILE_CREATED: { href: '/dashboard/interim-work', label: 'Interim Work' },
  PRIVACY_CONFIRMED: { href: '/dashboard/privacy', label: 'Privacy Settings' },
  JOB_BOARD_USAGE_CONFIRMED: { href: '/dashboard/find-my-job#job-recommendations', label: 'Find My Job' },
  MARKETING_PLAN_UNLOCK: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  GIG_DIRECTORY_UNLOCK: { href: '/dashboard/interim-work', label: 'Interim Work' },
  LINKEDIN_UNLOCK: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  WORK_SAMPLE_TYPE_CONFIRMED: { href: '/dashboard/work-samples', label: 'Work Samples' },
  NETWORK_COMFORT_CONFIRMED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  WATCHLIST_ADD: { href: '/dashboard/find-my-job#company-tracker', label: 'Find My Job' },
  WATCHLIST_POSTING_VIEWED: { href: '/dashboard/find-my-job#company-tracker', label: 'Find My Job' },
  // Points at where you'd go DO this (the job boards), not where you'd log
  // it afterward (#jobs-applied) — the Action Plan bullet is "apply to a new
  // job," an instruction to act, not a review of past applications.
  JOB_APPLICATION_SUBMITTED: { href: '/dashboard/find-my-job#apply-new-jobs', label: 'Find My Job' },
  JOB_INTERESTED_REACTION: { href: '/dashboard/find-my-job#job-recommendations', label: 'Find My Job' },
  GMAIL_CONNECTED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  GMAIL_RECONNECTED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  THANK_YOU_NOTE_SENT: { href: '/dashboard/network#needs-follow-up', label: 'Network with My Contacts' },
  FOLLOW_UP_NOTE_SENT: { href: '/dashboard/network#needs-follow-up', label: 'Network with My Contacts' },
  CHECK_IN_NOTE_SENT: { href: '/dashboard/network#needs-follow-up', label: 'Network with My Contacts' },
  INTRO_CONNECTION_REQUEST_SENT: { href: '/dashboard/network', label: 'Network with My Contacts' },
  CALENDAR_CONNECTED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  CALENDAR_RECONNECTED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  INTERVIEW_ATTENDED: { href: '/dashboard/network', label: 'Network with My Contacts' },
  PROFILE_PICTURE_UPLOADED: { href: '/dashboard/profile#profile-picture', label: 'Profile' },
  LINKEDIN_PROFILE_ADDED: { href: '/dashboard/profile#linkedin', label: 'Profile' },
}


// LLM-personalized action-plan items are written as "short action — why it
// matters" (see the HARD REQUIREMENT in hireability-report.ts) — this splits
// that apart so a UI can hyperlink only the short action name instead of
// underlining an entire explanatory sentence. Falls back to the whole string
// as the label when there's no dash (every canonical catalog item, which is
// already short with no reason baked in).
export function splitActionText(text: string): { label: string; why: string | null } {
  const idx = text.indexOf(' — ')
  if (idx === -1) return { label: text, why: null }
  return { label: text.slice(0, idx), why: text.slice(idx + 3) }
}

// One-line reasons for canonical catalog items, which (unlike LLM-authored
// action-plan items) don't carry their own "why" — keeps every action row
// showing a short reason without hand-writing one per nav category.
const WHY_OVERRIDE_BY_ACTION_TYPE: Partial<Record<string, string>> = {
  INTERIM_PROFILE_CREATED:
    'fills the gap on your resume — a priority once you have been searching more than 3 months',
  JOB_BOARD_USAGE_CONFIRMED: 'keeps new full-time openings coming to you every day',
  OUTREACH_MESSAGE: 'networking is the single most important thing you can do to land your next role',
  OUTREACH_CALL: 'a real conversation moves a relationship further than any message',
  NETWORKING_LIST: 'the people who already know you are your fastest path to a warm introduction',
  REFERENCE_ADDED: 'a strong reference is real proof for a hiring manager, not just your word',
  LEARNING_MODULE: 'a new skill makes you a stronger candidate for the roles you want',
  LEARNING_CERTIFICATE: 'a credential you can point to strengthens your resume and LinkedIn',
  LEARNING_NEW_TOOL: 'staying current on the tools employers use keeps you competitive',
  RESUME_UPDATE: 'a sharper resume gets you past the first screen',
  LINKEDIN_SETUP: 'most recruiters check LinkedIn before they ever call you',
}

const DEFAULT_WHY_BY_NAV_CATEGORY: Partial<Record<NavCategory, string>> = {
  Personalize: 'personalizes your search so we can match you to the right jobs and skills',
  Connecting: 'networking is the single most important thing you can do to find your next role',
  Building: 'gets you noticed by recruiters and ready for the interview',
  'Learning & Working': 'makes you a more employable candidate',
}

// Resolves the short reason shown next to an action row — an LLM-authored
// one (from splitActionText) always wins over these generic fallbacks.
export function getActionWhy(actionType: string | undefined, authoredWhy: string | null): string | null {
  if (authoredWhy) return authoredWhy
  if (actionType && WHY_OVERRIDE_BY_ACTION_TYPE[actionType]) return WHY_OVERRIDE_BY_ACTION_TYPE[actionType]!
  const category = navCategoryForActionType(actionType)
  return category ? (DEFAULT_WHY_BY_NAV_CATEGORY[category] ?? null) : null
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`
  const hours = minutes / 60
  return `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
}

// The Weekly Search Score point target for an A — ramps up over the first
// five weeks, then holds flat. Week is 1-indexed (week 1 = the candidate's
// first Weekly Search Sprint).
const WEEKLY_POINTS_RAMP = [60, 75, 90, 105, 120]

export function pointsNeededForA(weekNumber: number): number {
  const index = Math.min(Math.max(weekNumber, 1), WEEKLY_POINTS_RAMP.length) - 1
  return WEEKLY_POINTS_RAMP[index]
}

// Grade bands below A are a NextChapter judgment call — the vision doc only
// specifies the A threshold itself ("hit the weekly target"). Reuses the
// same B-at-75% convention this codebase already used for sprint grading.
export function gradeForWeeklyPoints(pointsEarned: number, pointsTarget: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (pointsTarget <= 0) return 'F'
  const fraction = pointsEarned / pointsTarget
  if (fraction >= 1) return 'A'
  if (fraction >= 0.75) return 'B'
  if (fraction >= 0.5) return 'C'
  if (fraction >= 0.25) return 'D'
  return 'F'
}

// Re-exported for convenience — pages importing PAGE_ACTION_TYPES usually
// need the PageKey type too, and this is the file most page.tsx files
// already import from.
export type { PageKey } from '@/lib/dashboard/page-content'

// Which actionTypes have a real, doable action on each page — grouped from
// ACTION_TYPE_LINK above (each entry there already points at exactly one of
// these pages). This is the single source of truth for the Action Plan
// box's per-page bullet list (see ActionPlanBox.tsx) — a Sprint action type
// belongs here only if there's a real feature on that page to do it with;
// this is also why THOUGHT_LEADERSHIP_COMMENT was retired rather than
// mapped anywhere (no dedicated "comment on an industry post" feature
// exists, so it had no real page to live on).
export const PAGE_ACTION_TYPES: Partial<Record<PageKey, string[]>> = {
  network: [
    'NETWORKING_LIST',
    'OUTREACH_MESSAGE',
    'OUTREACH_CALL',
    'NETWORK_COMFORT_CONFIRMED',
    'GMAIL_CONNECTED',
    'GMAIL_RECONNECTED',
    'THANK_YOU_NOTE_SENT',
    'FOLLOW_UP_NOTE_SENT',
    'CHECK_IN_NOTE_SENT',
    'INTRO_CONNECTION_REQUEST_SENT',
    'CALENDAR_CONNECTED',
    'CALENDAR_RECONNECTED',
    'INTERVIEW_ATTENDED',
  ],
  // Order matches the Action Plan box's own display order: Apply to a new
  // job, React to a job recommendation, Add a company to your tracker, Find
  // jobs through your network, Complete a mock interview — the last two
  // link to new #find-through-network/#mock-interview sections built at the
  // bottom of find-my-job/page.tsx specifically for this box, via
  // PAGE_ACTION_TYPE_OVERRIDE below. JOB_BOARD_USAGE_CONFIRMED intentionally
  // omitted — its UI (JobBoardUsageCheckIn) was removed and never rebuilt,
  // so it has no reachable action to complete (see profile-checklist.ts's
  // "dead" comment on the same action type). NETWORKING_LIST/GMAIL_CONNECTED/
  // RECONNECTED also listed under `network` (their real home) — duplicated
  // here too since building your network is real job-search work, and a
  // candidate on this page needs their inbox connected for interview/
  // application auto-detection to work at all.
  'find-my-job': [
    'JOB_APPLICATION_SUBMITTED',
    'JOB_INTERESTED_REACTION',
    'WATCHLIST_ADD',
    'NETWORKING_LIST',
    'INTERVIEW_PREP',
    'WATCHLIST_POSTING_VIEWED',
    'NEGOTIATION_ADVICE',
    'GMAIL_CONNECTED',
    'GMAIL_RECONNECTED',
  ],
  resume: ['RESUME_UPDATE', 'SKILLS_TRANSLATOR'],
  'interview-prep': ['INTERVIEW_PREP', 'INTERVIEW_BEHAVIORAL_PRACTICE', 'COMFORT_CHECK_CONFIRM'],
  'marketing-plan': ['LINKEDIN_POST_IDEA', 'THOUGHT_LEADERSHIP_SHARE', 'MARKETING_PLAN_UNLOCK'],
  learning: ['LEARNING_MODULE', 'LEARNING_CERTIFICATE', 'LEARNING_NEW_TOOL', 'LEARNING_SESSION_ATTENDED'],
  linkedin: ['LINKEDIN_SETUP', 'LINKEDIN_UNLOCK'],
  'interim-work': ['INTERIM_PROFILE_CREATED', 'GIG_DIRECTORY_UNLOCK'],
  'work-samples': ['WORK_SAMPLE_TYPE_CONFIRMED'],
  community: ['ENGAGE_COMMENT', 'ENGAGE_EVENT', 'ENGAGE_POST_UPDATE', 'ENGAGE_PEER_SUPPORT'],
  profile: [
    'PROFILE_CONFIRM',
    'INDUSTRY_CONFIRM',
    'FUNCTION_CONFIRM',
    'SALARY_CONFIRM',
    'WORK_AUTHORIZATION',
    'ANSWER_OPTIONAL_QUESTIONS',
    'PROFILE_PICTURE_UPLOADED',
    'LINKEDIN_PROFILE_ADDED',
  ],
  privacy: ['PRIVACY_CONFIRMED'],
  references: ['REFERENCE_ADDED'],
  'skills-assessments': ['WORKING_STYLE_QUIZ', 'SKILLS_ASSESSMENT_COMPLETED'],
  'search-strategy': [],
  stats: [],
  'got-hired': [],
  benefits: [],
  // No Action Plan on this page by design — it's private, optional, and
  // never activity-triggered (see the page's own copy); an empty array
  // means PageHeaderBoxes still renders Daily Message/Why It Matters here,
  // just no third box.
  support: [],
}

// Per-page overrides for a handful of action types whose canonical
// text/link (used everywhere else this actionType shows up — the Network
// page's own Action Plan, the dashboard Sprint card, stats page) doesn't
// fit a specific page's Action Plan box context. find-my-job links
// NETWORKING_LIST/INTERVIEW_PREP into two sections built at the bottom of
// find-my-job/page.tsx specifically for this box, rather than jumping
// straight off the page, and reframes the networking bullet in job-search
// terms — the underlying real action and points are unchanged, only how
// this one box presents and links it.
export const PAGE_ACTION_TYPE_OVERRIDE: Partial<
  Record<PageKey, Partial<Record<string, { text?: string; href: string; label: string }>>>
> = {
  'find-my-job': {
    NETWORKING_LIST: {
      text: 'Find jobs through your network',
      href: '/dashboard/find-my-job#find-through-network',
      label: 'Find My Job',
    },
    INTERVIEW_PREP: { href: '/dashboard/find-my-job#mock-interview', label: 'Find My Job' },
  },
}
