import type { CoachSessionType } from '@prisma/client'

// Plain constants shared by server code (src/lib/admin/coaching-rate-card.ts)
// and client components (e.g. LogSessionForm) — kept separate from
// coaching-rate-card.ts's `import 'server-only'` DB helpers so a client
// component can import the labels without pulling in server-only code.
export const COACH_SESSION_TYPES: CoachSessionType[] = [
  'STANDARD',
  'EXECUTIVE_BAND',
  'MOCK_INTERVIEW_90',
  'RESUME_REVIEW',
  'INTAKE',
]

export const COACH_SESSION_TYPE_LABELS: Record<CoachSessionType, string> = {
  STANDARD: 'Standard session',
  EXECUTIVE_BAND: 'Executive-band session',
  MOCK_INTERVIEW_90: 'Mock interview (90 min)',
  RESUME_REVIEW: 'Resume review (flat)',
  INTAKE: 'Intake session',
}

// Partners Master Build Script §A2.5 defaults, in cents.
export const COACH_RATE_CARD_DEFAULTS: Record<CoachSessionType, number> = {
  STANDARD: 11000,
  EXECUTIVE_BAND: 15000,
  MOCK_INTERVIEW_90: 17500,
  RESUME_REVIEW: 8500,
  INTAKE: 13000,
}
