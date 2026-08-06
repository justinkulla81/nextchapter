// Weekly Search Score points model — 1 point = 1 minute of real effort,
// exactly as documented to candidates in the FAQ/Glossary. Every Search
// Action has a fixed point value; nothing is estimated or judgment-weighted
// anymore.

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
  THOUGHT_LEADERSHIP_COMMENT: { minutes: 5, points: 5 },
  THOUGHT_LEADERSHIP_SHARE: { minutes: 10, points: 10 },

  // Learning
  LEARNING_MODULE: { minutes: 20, points: 20 },
  LEARNING_CERTIFICATE: { minutes: 40, points: 40 },
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

  // Prompt 76 — Gmail activity tracking. One-time connection bonus, same
  // weight as other one-time confirm bonuses. The four Sent-folder
  // categories are real, distinct networking actions — never merged into
  // one "outreach" bucket — with INTRO_CONNECTION_REQUEST weighted higher
  // since asking for an introduction is a more substantive ask than a
  // routine note.
  GMAIL_CONNECTED: { minutes: 5, points: 10 },
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
  SUBSTACK_UNLOCK: { minutes: 3, points: 5 },
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
  THOUGHT_LEADERSHIP_COMMENT: 'working',
  THOUGHT_LEADERSHIP_SHARE: 'working',
  RESUME_UPDATE: 'working',
  SKILLS_TRANSLATOR: 'working',
  LINKEDIN_SETUP: 'working',

  LEARNING_MODULE: 'learning',
  LEARNING_CERTIFICATE: 'learning',
  LEARNING_NEW_TOOL: 'learning',
  LEARNING_SESSION_ATTENDED: 'learning',

  INTERVIEW_PREP: 'effort',
  INTERVIEW_BEHAVIORAL_PRACTICE: 'effort',
  NEGOTIATION_ADVICE: 'effort',
  ASSESSMENT_COMPLETE: 'effort',
  WORKING_STYLE_QUIZ: 'effort',
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
  GMAIL_CONNECTED: 'connecting',
  THANK_YOU_NOTE_SENT: 'connecting',
  FOLLOW_UP_NOTE_SENT: 'connecting',
  CHECK_IN_NOTE_SENT: 'connecting',
  INTRO_CONNECTION_REQUEST_SENT: 'connecting',
  CALENDAR_CONNECTED: 'connecting',
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
  SUBSTACK_UNLOCK: 'working',
}

export function engineForActionType(actionType: string | undefined): SearchExecutionEngineKey {
  if (actionType && ENGINE_BY_ACTION_TYPE[actionType]) return ENGINE_BY_ACTION_TYPE[actionType]
  return 'effort'
}

// Which top-level hamburger-nav section (Building / Connecting / Learning &
// Working) each action type's real work happens under — a separate axis
// from the four scoring engines above (engine = what it counts toward,
// nav category = where you'd actually go do it). Kept as its own map
// rather than derived from ACTION_TYPE_LINK's href so it stays correct
// even for action types with no deep link.
export type NavCategory = 'Building' | 'Connecting' | 'Learning & Working'

const NAV_CATEGORY_BY_ACTION_TYPE: Partial<Record<string, NavCategory>> = {
  WORKING_STYLE_QUIZ: 'Building',
  RESUME_UPDATE: 'Building',
  SKILLS_TRANSLATOR: 'Building',
  INTERVIEW_PREP: 'Building',
  INTERVIEW_BEHAVIORAL_PRACTICE: 'Building',
  LINKEDIN_POST_IDEA: 'Building',
  THOUGHT_LEADERSHIP_COMMENT: 'Building',
  THOUGHT_LEADERSHIP_SHARE: 'Building',
  MARKETING_PLAN_UNLOCK: 'Building',
  SUBSTACK_UNLOCK: 'Building',
  LINKEDIN_SETUP: 'Building',
  LINKEDIN_UNLOCK: 'Building',
  WORK_SAMPLE_TYPE_CONFIRMED: 'Building',
  PROFILE_CONFIRM: 'Building',
  INDUSTRY_CONFIRM: 'Building',
  FUNCTION_CONFIRM: 'Building',
  SALARY_CONFIRM: 'Building',
  WORK_AUTHORIZATION: 'Building',
  ANSWER_OPTIONAL_QUESTIONS: 'Building',
  COMFORT_CHECK_CONFIRM: 'Building',

  NETWORKING_LIST: 'Connecting',
  OUTREACH_MESSAGE: 'Connecting',
  OUTREACH_CALL: 'Connecting',
  NETWORK_COMFORT_CONFIRMED: 'Connecting',
  ENGAGE_COMMENT: 'Connecting',
  ENGAGE_EVENT: 'Connecting',
  ENGAGE_POST_UPDATE: 'Connecting',
  ENGAGE_PEER_SUPPORT: 'Connecting',
  MOOD_CHECKIN: 'Connecting',
  PRIVACY_CONFIRMED: 'Connecting',
  VISIBILITY_COMFORT_CHECKIN: 'Connecting',
  GMAIL_CONNECTED: 'Connecting',
  THANK_YOU_NOTE_SENT: 'Connecting',
  FOLLOW_UP_NOTE_SENT: 'Connecting',
  CHECK_IN_NOTE_SENT: 'Connecting',
  INTRO_CONNECTION_REQUEST_SENT: 'Connecting',
  CALENDAR_CONNECTED: 'Connecting',
  INTERVIEW_ATTENDED: 'Connecting',

  LEARNING_MODULE: 'Learning & Working',
  LEARNING_CERTIFICATE: 'Learning & Working',
  LEARNING_NEW_TOOL: 'Learning & Working',
  LEARNING_SESSION_ATTENDED: 'Learning & Working',
  NEGOTIATION_ADVICE: 'Learning & Working',
  JOB_BOARD_USAGE_CONFIRMED: 'Learning & Working',
  INTERIM_PROFILE_CREATED: 'Learning & Working',
  GIG_DIRECTORY_UNLOCK: 'Learning & Working',
  PARTNER_CLICK_THROUGH: 'Learning & Working',
  WATCHLIST_ADD: 'Learning & Working',
  WATCHLIST_POSTING_VIEWED: 'Learning & Working',
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
  'THOUGHT_LEADERSHIP_COMMENT',
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
])

export function isRecurringActionType(actionType: string | undefined): boolean {
  return !!actionType && RECURRING_ACTION_TYPES.has(actionType)
}

// A suggested rep count per week for recurring types the candidate actively
// plans (surfaced in the committed/catalog list) — lets the dashboard show
// "2 x 15 pts = 30 pts" instead of a bare point value, so the target reads
// as a concrete number of real-world actions, not just an abstract score.
// Starting defaults, tuned to land near typical weekly point targets —
// adjust freely per type. Deliberately excludes the five passively-detected
// types below (THANK_YOU_NOTE_SENT, FOLLOW_UP_NOTE_SENT, CHECK_IN_NOTE_SENT,
// INTRO_CONNECTION_REQUEST_SENT, INTERVIEW_ATTENDED) — those accrue from
// Gmail/Calendar reconciliation, not a candidate-set goal, so a "target
// count" wouldn't correspond to anything the candidate is planning. Also
// excludes ENGAGE_PEER_SUPPORT (0 points, nothing to multiply).
const RECURRING_ACTION_TARGET_COUNT: Partial<Record<string, number>> = {
  OUTREACH_MESSAGE: 2,
  OUTREACH_CALL: 1,
  ENGAGE_COMMENT: 3,
  ENGAGE_EVENT: 1,
  ENGAGE_POST_UPDATE: 1,
  LINKEDIN_POST_IDEA: 1,
  THOUGHT_LEADERSHIP_COMMENT: 3,
  THOUGHT_LEADERSHIP_SHARE: 2,
  INTERVIEW_BEHAVIORAL_PRACTICE: 2,
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
  'ANSWER_OPTIONAL_QUESTIONS',
  'COMFORT_CHECK_CONFIRM',
])

export function isVerifiedActionType(actionType: string | undefined): boolean {
  return !!actionType && VERIFIED_ACTION_TYPES.has(actionType)
}

// Action types with a real automatic detector (Gmail sync, Calendar sync,
// or CSV import) — distinct from VERIFIED_ACTION_TYPES above, which feeds
// reconcileVerifiedActions's DB-column override for an unrelated set of
// onboarding confirms. This Set exists so SprintActionCompletion can render
// a plain status readout instead of a self-report "Mark done" button for
// anything the app can already verify — no self-report, no partial-trust
// fallback, for any candidate, per the product rule that a self-report
// click is not evidence.
export const AUTO_DETECTED_ACTION_TYPES = new Set<string>([
  'OUTREACH_MESSAGE',
  'OUTREACH_CALL',
  'NETWORKING_LIST',
  'FOLLOW_UP_NOTE_SENT',
  'THANK_YOU_NOTE_SENT',
  'CHECK_IN_NOTE_SENT',
  'INTRO_CONNECTION_REQUEST_SENT',
  'INTERVIEW_ATTENDED',
  'LEARNING_SESSION_ATTENDED',
])

export function isAutoDetectedActionType(actionType: string | undefined): boolean {
  return !!actionType && AUTO_DETECTED_ACTION_TYPES.has(actionType)
}

// Where each action type's real work actually happens — used to make
// committed Sprint items click through to the page where you do the work,
// instead of just toggling a checkbox in place.
export const ACTION_TYPE_LINK: Partial<Record<string, { href: string; label: string }>> = {
  NETWORKING_LIST: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_MESSAGE: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_CALL: { href: '/dashboard/network', label: 'My Network' },
  ENGAGE_COMMENT: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_EVENT: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_POST_UPDATE: { href: '/dashboard/community', label: 'Support Network' },
  ENGAGE_PEER_SUPPORT: { href: '/dashboard/community', label: 'Support Network' },
  LINKEDIN_SETUP: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  LINKEDIN_POST_IDEA: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  THOUGHT_LEADERSHIP_COMMENT: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  THOUGHT_LEADERSHIP_SHARE: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  LEARNING_MODULE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_CERTIFICATE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_NEW_TOOL: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_SESSION_ATTENDED: { href: '/dashboard/learning', label: 'Learning' },
  RESUME_UPDATE: { href: '/dashboard/resume', label: 'Resume' },
  SKILLS_TRANSLATOR: { href: '/dashboard/resume', label: 'Resume' },
  INTERVIEW_PREP: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  INTERVIEW_BEHAVIORAL_PRACTICE: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  NEGOTIATION_ADVICE: { href: '/dashboard/find-my-job', label: 'Find My Job' },
  // Hash anchors so clicking a profile task lands scrolled to that exact
  // section instead of the top of a long page — see the matching `id`s on
  // each Card in src/app/dashboard/profile/page.tsx.
  PROFILE_CONFIRM: { href: '/dashboard/profile#basics', label: 'Profile' },
  INDUSTRY_CONFIRM: { href: '/dashboard/profile#industry', label: 'Profile' },
  FUNCTION_CONFIRM: { href: '/dashboard/profile#function-experience', label: 'Profile' },
  SALARY_CONFIRM: { href: '/dashboard/profile#salary', label: 'Profile' },
  WORK_AUTHORIZATION: { href: '/dashboard/profile#work-authorization', label: 'Profile' },
  WORKING_STYLE_QUIZ: { href: '/dashboard/retake-assessment', label: 'How I Work Best' },
  COMFORT_CHECK_CONFIRM: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  INTERIM_PROFILE_CREATED: { href: '/dashboard/interim-work', label: 'Interim Work' },
  PRIVACY_CONFIRMED: { href: '/dashboard/privacy', label: 'Privacy Settings' },
  JOB_BOARD_USAGE_CONFIRMED: { href: '/dashboard/find-my-job', label: 'Find My Job' },
  MARKETING_PLAN_UNLOCK: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  GIG_DIRECTORY_UNLOCK: { href: '/dashboard/interim-work', label: 'Interim Work' },
  LINKEDIN_UNLOCK: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  WORK_SAMPLE_TYPE_CONFIRMED: { href: '/dashboard/work-samples', label: 'Work Samples' },
  NETWORK_COMFORT_CONFIRMED: { href: '/dashboard/network', label: 'Outreach Contacts' },
  SUBSTACK_UNLOCK: { href: '/dashboard/marketing-plan', label: 'Marketing Plan' },
  WATCHLIST_ADD: { href: '/dashboard/find-my-job', label: 'Find My Job' },
  WATCHLIST_POSTING_VIEWED: { href: '/dashboard/find-my-job', label: 'Find My Job' },
  GMAIL_CONNECTED: { href: '/dashboard/network', label: 'Outreach Contacts' },
  THANK_YOU_NOTE_SENT: { href: '/dashboard/network', label: 'Outreach Contacts' },
  FOLLOW_UP_NOTE_SENT: { href: '/dashboard/network', label: 'Outreach Contacts' },
  CHECK_IN_NOTE_SENT: { href: '/dashboard/network', label: 'Outreach Contacts' },
  INTRO_CONNECTION_REQUEST_SENT: { href: '/dashboard/network', label: 'Outreach Contacts' },
  CALENDAR_CONNECTED: { href: '/dashboard/network', label: 'Outreach Contacts' },
  INTERVIEW_ATTENDED: { href: '/dashboard/network', label: 'Outreach Contacts' },
}

// actionTypes that represent real growth/stretch effort (networking,
// learning, and starting an interim-work search) — the ones worth pushing
// on specifically when a candidate says they're feeling motivated, per the
// "capitalize on it" framing rather than just "give them the biggest number."
const GROWTH_ACTION_TYPES = new Set([
  'OUTREACH_MESSAGE',
  'OUTREACH_CALL',
  'NETWORKING_LIST',
  'LEARNING_MODULE',
  'LEARNING_CERTIFICATE',
  'LEARNING_NEW_TOOL',
  'INTERIM_PROFILE_CREATED',
])

// The Mood Check-In card's "here's some ideas for today" list — the
// current week's Sprint is the one real source of "what should I do today,"
// so this just filters it down to what's left, capped to a short scannable
// list. When today's mood is known, the order is tilted by it: feeling
// motivated (MOVING/FIRED_UP) surfaces the higher-effort, higher-point
// growth actions (networking, learning, starting an interim-work search)
// first so the candidate capitalizes on the momentum; feeling low
// (STUCK/GETTING_THERE) surfaces the cheapest already-open actions first,
// so there's an easy win available rather than the biggest ask in the list.
export function getMoodCardIdeas<T extends { text: string; actionType?: string; completed: boolean }>(
  committedActions: T[] | null | undefined,
  max = 3,
  mood?: import('@prisma/client').Mood | null
): T[] {
  if (!committedActions) return []
  const open = committedActions.filter((a) => !a.completed)

  if (mood === 'MOVING' || mood === 'FIRED_UP') {
    return [...open]
      .sort((a, b) => {
        const aGrowth = a.actionType && GROWTH_ACTION_TYPES.has(a.actionType) ? 1 : 0
        const bGrowth = b.actionType && GROWTH_ACTION_TYPES.has(b.actionType) ? 1 : 0
        if (aGrowth !== bGrowth) return bGrowth - aGrowth
        return estimateActionEffort(b).points - estimateActionEffort(a).points
      })
      .slice(0, max)
  }

  if (mood === 'STUCK' || mood === 'GETTING_THERE') {
    return [...open].sort((a, b) => estimateActionEffort(a).points - estimateActionEffort(b).points).slice(0, max)
  }

  return open.slice(0, max)
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
