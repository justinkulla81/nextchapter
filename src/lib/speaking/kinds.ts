/** The kinds and stages of a CEO speaking opportunity. Strings in the database, closed lists here. */
export const SPEAKING_KINDS = [
  { key: 'KEYNOTE', label: 'Keynote', hint: 'Main-stage or featured talk' },
  { key: 'PANEL', label: 'Panel', hint: 'Panelist, moderator or fireside chat' },
  { key: 'RESEARCH_APPLICATION', label: 'Research application', hint: 'Fellowships, labs, studies and programs that take an application' },
  { key: 'DEMO_DAY', label: 'Demo day', hint: 'Startup showcases, pitch days, product demos' },
  { key: 'PODCAST_WEBINAR', label: 'Podcast / webinar', hint: 'Guest spots on shows and online sessions' },
  { key: 'AWARD_CHALLENGE', label: 'Award / challenge', hint: 'Competitions, awards and nominations' },
] as const
export type SpeakingKind = (typeof SPEAKING_KINDS)[number]['key']

export const SPEAKING_STATUSES = [
  { key: 'NEW', label: 'New' },
  { key: 'PLANNING', label: 'Going for it' },
  { key: 'APPLIED', label: 'Applied' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DONE', label: 'Done' },
  { key: 'PASSED', label: 'Passed' },
] as const
export type SpeakingStatus = (typeof SPEAKING_STATUSES)[number]['key']

/** Stages that still need Justin to do something. */
export const OPEN_STATUSES: SpeakingStatus[] = ['NEW', 'PLANNING']

export function isKind(v: unknown): v is SpeakingKind {
  return SPEAKING_KINDS.some((k) => k.key === v)
}
export function isStatus(v: unknown): v is SpeakingStatus {
  return SPEAKING_STATUSES.some((s) => s.key === v)
}

/** Maps a conference opportunity type (ConferenceOpportunity.type) to what it is for the CEO. */
export function kindFromConferenceType(type: string): SpeakingKind | null {
  switch (type) {
    case 'CALL_FOR_SPEAKERS': return 'PANEL'
    case 'CALL_FOR_SUBMISSIONS': return 'PANEL'
    case 'PRESENTATION': return 'PANEL'
    case 'DEMO': return 'DEMO_DAY'
    case 'CONTEST': return 'AWARD_CHALLENGE'
    case 'AWARD': return 'AWARD_CHALLENGE'
    default: return null
  }
}
