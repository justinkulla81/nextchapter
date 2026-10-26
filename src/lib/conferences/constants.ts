// Closed vocabularies for conference tracking and opportunities (Conferences v2).

export const USER_STATUSES = ['INTERESTED', 'TRACKING', 'REGISTERED', 'ATTENDING', 'ATTENDED', 'SPEAKING', 'SKIPPED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  INTERESTED: 'Interested', TRACKING: 'Tracking', REGISTERED: 'Registered', ATTENDING: 'Attending', ATTENDED: 'Attended', SPEAKING: 'Speaking', SKIPPED: 'Skipped',
}
/** The older ConferenceInterest states map onto the new ones so the two pages stay in step. */
export const INTEREST_TO_STATUS: Record<string, UserStatus> = { SAVED: 'INTERESTED', GOING: 'ATTENDING', SPEAKING: 'SPEAKING', FOLLOWING: 'TRACKING' }

export const OPPORTUNITY_TYPES = ['CALL_FOR_SPEAKERS', 'CALL_FOR_SUBMISSIONS', 'REGISTRATION', 'REPORT', 'CONTEST', 'PRESENTATION', 'AWARD', 'DEMO'] as const
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]
export const OPPORTUNITY_LABEL: Record<OpportunityType, string> = {
  CALL_FOR_SPEAKERS: 'Call for speakers',
  CALL_FOR_SUBMISSIONS: 'Call for submissions or papers',
  REGISTRATION: 'Registration dates',
  REPORT: 'Report from the conference',
  CONTEST: 'Contest or competition',
  PRESENTATION: 'Presentation or session',
  AWARD: 'Award or nomination',
  DEMO: 'Demo or showcase',
}
/**
 * Types a member can send something to before a deadline. Registration is tracked on the conference itself
 * (Registered), not per opportunity, and reports and sessions are reading and watching.
 */
export const ACTIONABLE_TYPES: readonly OpportunityType[] = ['CALL_FOR_SPEAKERS', 'CALL_FOR_SUBMISSIONS', 'CONTEST', 'AWARD', 'DEMO']

export const TRACK_STATUSES = ['WATCHING', 'DRAFTING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'DELIVERED'] as const
export type TrackStatus = (typeof TRACK_STATUSES)[number]
export const TRACK_LABEL: Record<TrackStatus, string> = {
  WATCHING: 'Watching', DRAFTING: 'Drafting', SUBMITTED: 'Submitted', ACCEPTED: 'Accepted', REJECTED: 'Rejected', DELIVERED: 'Delivered',
}
/** Outcomes that count as observable activity on the Dossier. */
export const EVIDENCE_TRACK_STATUSES: readonly TrackStatus[] = ['ACCEPTED', 'DELIVERED']

export const TALK_KINDS = ['TALK', 'AWARD', 'SUBMISSION_ACCEPTED', 'DEMO'] as const
export type TalkKind = (typeof TALK_KINDS)[number]
export const TALK_KIND_LABEL: Record<TalkKind, string> = { TALK: 'Talk', AWARD: 'Award', SUBMISSION_ACCEPTED: 'Accepted submission', DEMO: 'Demo' }

export const CHANGE_KINDS = ['DATES', 'NEW_OPPORTUNITY', 'OPPORTUNITY_DEADLINE'] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

/** Model calls a member may spend on Quick Add per rolling day. Cached results and known catalog entries are free. */
export const QUICK_ADD_DAILY_CAP = 10
