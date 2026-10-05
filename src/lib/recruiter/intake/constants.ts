// NextChapter Talent (recruiter intake) shared constants. Pure — safe to
// import from client components and tests.

import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'

export const TALENT_PRODUCT_NAME = 'NextChapter Talent'

// Consent is granted to the firm (spec "Consent scopes"). Order = display order.
export const INTAKE_CONSENT_SCOPES = ['status', 'landing_details', 'profile_updates', 'contact'] as const
export type IntakeConsentScope = (typeof INTAKE_CONSENT_SCOPES)[number]

export const INTAKE_CONSENT_SCOPE_LABELS: Record<IntakeConsentScope, { label: string; detail: string }> = {
  status: {
    label: 'My search status',
    detail: 'Searching, interviewing, or landed.',
  },
  landing_details: {
    label: 'Where I land',
    detail: 'New employer, title and start date, once I have started.',
  },
  profile_updates: {
    label: 'Profile updates',
    detail: 'A newer resume, location and pay expectations.',
  },
  contact: {
    label: 'Messages',
    detail: 'The firm can message me through NextChapter.',
  },
}

export function isIntakeConsentScope(value: string): value is IntakeConsentScope {
  return (INTAKE_CONSENT_SCOPES as readonly string[]).includes(value)
}

export const INTAKE_LEVELS = HIGHEST_LEVEL_OPTIONS
export type IntakeLevel = (typeof INTAKE_LEVELS)[number]

export function levelRank(level: string | null | undefined): number | null {
  if (!level) return null
  const index = (INTAKE_LEVELS as readonly string[]).indexOf(level)
  return index === -1 ? null : index
}

// Unclaimed intake profiles are deleted after this many days (spec: 60).
export const INTAKE_PURGE_DAYS = 60
// Claim reminders stop after this many (spec: 2 reminders after the first invite).
export const INTAKE_MAX_CLAIM_INVITES = 3
export const INTAKE_CLAIM_REMINDER_GAP_DAYS = 7

export const INTAKE_MAX_FILE_BYTES = 10 * 1024 * 1024

export const INTAKE_FORWARD_DOMAIN = process.env.INTAKE_FORWARD_DOMAIN || 'in.launchyournextchapter.com'

export const INTAKE_REPLY_KIND_LABELS = {
  NICHE: 'In your niche',
  OUTSIDE: 'Outside current focus',
} as const

export const INTAKE_TAG_LABELS = {
  FIT: 'Fit',
  NICHE: 'In your niche',
  OUTSIDE: 'Outside current focus',
} as const

export const INTAKE_ROUTING_MODE_LABELS = {
  SUGGEST: 'Suggest, a coordinator confirms',
  AUTO: 'Assign to the best match',
  ROUND_ROBIN: 'Round-robin among matching recruiters',
} as const
