export const SENIORITIES = ['EARLY', 'MID', 'SENIOR', 'EXECUTIVE'] as const
export type Seniority = (typeof SENIORITIES)[number]
export const SENIORITY_LABEL: Record<Seniority, string> = {
  EARLY: 'Early career',
  MID: 'Mid career',
  SENIOR: 'Senior',
  EXECUTIVE: 'Executive',
}

export const KINDS = ['CONFERENCE', 'TRADE_SHOW', 'SUMMIT', 'WORKSHOP'] as const
export const KIND_LABEL: Record<(typeof KINDS)[number], string> = { CONFERENCE: 'Conference', TRADE_SHOW: 'Trade show', SUMMIT: 'Summit', WORKSHOP: 'Workshop' }

export const FORMATS = ['IN_PERSON', 'VIRTUAL', 'HYBRID'] as const
export const FORMAT_LABEL: Record<(typeof FORMATS)[number], string> = { IN_PERSON: 'In person', VIRTUAL: 'Online', HYBRID: 'In person and online' }

/** How a person gets in: pays, walks in free, needs an invitation, or applies and is chosen. */
export const ACCESS = ['PAID', 'FREE', 'INVITE', 'APPLY', 'MIXED'] as const
export type Access = (typeof ACCESS)[number]
export const ACCESS_LABEL: Record<Access, string> = {
  PAID: 'Paid ticket',
  FREE: 'Free',
  INVITE: 'Invitation only',
  APPLY: 'Apply to attend',
  MIXED: 'Free expo, paid sessions',
}

export const SPEAKING = ['OPEN_CFP', 'BY_INVITE', 'NONE', 'UNKNOWN'] as const
export type Speaking = (typeof SPEAKING)[number]
export const SPEAKING_LABEL: Record<Speaking, string> = {
  OPEN_CFP: 'Open call for speakers',
  BY_INVITE: 'Speakers are invited',
  NONE: 'No speaking slots',
  UNKNOWN: 'Speaking not checked',
}

export interface ConferenceRow {
  id: string
  name: string
  organizer: string | null
  url: string | null
  kind: string
  format: string
  startDate: Date | null
  endDate: Date | null
  datesConfirmed: boolean
  typicalMonth: string | null
  city: string | null
  state: string | null
  country: string
  industries: string[]
  functions: string[]
  seniorities: string[]
  importance: number
  whyAttend: string | null
  access: string
  costLow: number | null
  costHigh: number | null
  costNote: string | null
  speaking: string
  speakingUrl: string | null
  speakingDeadline: Date | null
  speakingNote: string | null
  cheaperWays: string | null
  applyUrl: string | null
  applyDeadline: Date | null
  published: boolean
  verified: boolean
  checkedAt: Date | null
  locked: boolean
  adminNote: string | null
  source: string | null
}
