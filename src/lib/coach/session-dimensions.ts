import type { CoachSession, SessionDimensionStatus, SessionDimensionTrend } from '@prisma/client'

// Master Build Script §A5.1 — the seven dimensions every coaching session
// tracks, in the spec's own order. Plain constants (no `server-only`) so
// both the client-side logging form and every server-side reader (pre-
// session brief, trend line, intervention suggestions) import one shared
// source of truth instead of re-typing the seven keys.
export const SESSION_DIMENSIONS = [
  'targeting',
  'motivation',
  'networking',
  'applicationVolume',
  'skills',
  'narrative',
  'interviewPractice',
] as const

export type SessionDimensionKey = (typeof SESSION_DIMENSIONS)[number]

export const SESSION_DIMENSION_LABEL: Record<SessionDimensionKey, string> = {
  targeting: 'Targeting',
  motivation: 'Motivation',
  networking: 'Networking',
  applicationVolume: 'Application volume',
  skills: 'Skills',
  narrative: 'Narrative',
  interviewPractice: 'Interview practice',
}

// Spec's own "tracked" column, §A5.1 table — shown as the field hint under
// each dimension in the logging form.
export const SESSION_DIMENSION_DESCRIPTION: Record<SessionDimensionKey, string> = {
  targeting: 'Applying to the right jobs? Match quality, level fit, scattershot rate.',
  motivation: 'Energy, discouragement, momentum — rate what you saw this session.',
  networking: 'Volume, warmth, reply rate, comfort trend.',
  applicationVolume: 'Rate, conversion, right channel for their level.',
  skills: 'Named gaps, progress against them.',
  narrative: 'Can they tell their story? Gap explanation, "why you."',
  interviewPractice: 'Sessions completed, stage where they lose, specific weaknesses.',
}

// Which CoachSession columns back each dimension — one place that knows the
// targeting -> dimTargetingStatus/dimTargetingTrend/dimTargetingNote naming
// convention, so every reader/writer loops SESSION_DIMENSIONS instead of
// hand-listing 21 field names.
export const SESSION_DIMENSION_FIELDS: Record<
  SessionDimensionKey,
  { status: keyof CoachSession; trend: keyof CoachSession; note: keyof CoachSession }
> = {
  targeting: { status: 'dimTargetingStatus', trend: 'dimTargetingTrend', note: 'dimTargetingNote' },
  motivation: { status: 'dimMotivationStatus', trend: 'dimMotivationTrend', note: 'dimMotivationNote' },
  networking: { status: 'dimNetworkingStatus', trend: 'dimNetworkingTrend', note: 'dimNetworkingNote' },
  applicationVolume: {
    status: 'dimApplicationVolumeStatus',
    trend: 'dimApplicationVolumeTrend',
    note: 'dimApplicationVolumeNote',
  },
  skills: { status: 'dimSkillsStatus', trend: 'dimSkillsTrend', note: 'dimSkillsNote' },
  narrative: { status: 'dimNarrativeStatus', trend: 'dimNarrativeTrend', note: 'dimNarrativeNote' },
  interviewPractice: {
    status: 'dimInterviewPracticeStatus',
    trend: 'dimInterviewPracticeTrend',
    note: 'dimInterviewPracticeNote',
  },
}

export const SESSION_DIMENSION_STATUSES: SessionDimensionStatus[] = ['ON_TRACK', 'AT_RISK', 'STALLED']

export const SESSION_DIMENSION_STATUS_LABEL: Record<SessionDimensionStatus, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  STALLED: 'Stalled',
}

export const SESSION_DIMENSION_TRENDS: SessionDimensionTrend[] = ['IMPROVING', 'STEADY', 'DECLINING']

export const SESSION_DIMENSION_TREND_LABEL: Record<SessionDimensionTrend, string> = {
  IMPROVING: 'Improving',
  STEADY: 'Steady',
  DECLINING: 'Declining',
}

// Tailwind classes for the status dot/pill — same "quieter than the grade
// itself" restraint as CONFIDENCE_STYLE in scoring/grade.ts.
export const SESSION_DIMENSION_STATUS_STYLE: Record<SessionDimensionStatus, string> = {
  ON_TRACK: 'bg-success/10 text-success',
  AT_RISK: 'bg-warning/10 text-warning',
  STALLED: 'bg-error/10 text-error',
}

export interface DimensionReading {
  key: SessionDimensionKey
  status: SessionDimensionStatus | null
  trend: SessionDimensionTrend | null
  note: string | null
}

// Pulls one dimension's triad off a CoachSession row (or any object shaped
// like one) — the single place that does the keyof-indexed read so callers
// never hand-index dimSomethingStatus themselves.
export function readDimension(
  session: Pick<CoachSession, keyof CoachSession>,
  key: SessionDimensionKey
): DimensionReading {
  const fields = SESSION_DIMENSION_FIELDS[key]
  return {
    key,
    status: (session[fields.status] as SessionDimensionStatus | null) ?? null,
    trend: (session[fields.trend] as SessionDimensionTrend | null) ?? null,
    note: (session[fields.note] as string | null) ?? null,
  }
}

// A dimension counts as "a concern" for intervention-suggestion purposes
// (§A5.1: "2+ dimensions at-risk/declining") if its status is AT_RISK or
// STALLED, or its trend is DECLINING — either signal alone is real enough
// to count, since a coach might log a still-ON_TRACK dimension that's
// nonetheless trending the wrong way.
export function isDimensionConcerning(reading: Pick<DimensionReading, 'status' | 'trend'>): boolean {
  return reading.status === 'AT_RISK' || reading.status === 'STALLED' || reading.trend === 'DECLINING'
}

// Form field name for a given dimension/axis — shared by LogSessionForm
// (name= attributes) and its server action (formData.get reads), so the two
// can never drift apart.
export function dimensionFieldName(key: SessionDimensionKey, axis: 'status' | 'trend' | 'note'): string {
  return `dim_${key}_${axis}`
}

function parseStatus(formData: FormData, key: SessionDimensionKey): SessionDimensionStatus | null {
  const raw = formData.get(dimensionFieldName(key, 'status')) as string | null
  return raw && (SESSION_DIMENSION_STATUSES as string[]).includes(raw) ? (raw as SessionDimensionStatus) : null
}

function parseTrend(formData: FormData, key: SessionDimensionKey): SessionDimensionTrend | null {
  const raw = formData.get(dimensionFieldName(key, 'trend')) as string | null
  return raw && (SESSION_DIMENSION_TRENDS as string[]).includes(raw) ? (raw as SessionDimensionTrend) : null
}

function parseNote(formData: FormData, key: SessionDimensionKey): string | null {
  return (formData.get(dimensionFieldName(key, 'note')) as string | null)?.trim() || null
}

// Exact shape of CoachSession's 21 dimension columns — typed explicitly
// (rather than a dynamic Record) so this can be spread straight into a
// `prisma.coachSession.create`/`update` data object with full type safety.
export interface DimensionFormValues {
  dimTargetingStatus: SessionDimensionStatus | null
  dimTargetingTrend: SessionDimensionTrend | null
  dimTargetingNote: string | null
  dimMotivationStatus: SessionDimensionStatus | null
  dimMotivationTrend: SessionDimensionTrend | null
  dimMotivationNote: string | null
  dimNetworkingStatus: SessionDimensionStatus | null
  dimNetworkingTrend: SessionDimensionTrend | null
  dimNetworkingNote: string | null
  dimApplicationVolumeStatus: SessionDimensionStatus | null
  dimApplicationVolumeTrend: SessionDimensionTrend | null
  dimApplicationVolumeNote: string | null
  dimSkillsStatus: SessionDimensionStatus | null
  dimSkillsTrend: SessionDimensionTrend | null
  dimSkillsNote: string | null
  dimNarrativeStatus: SessionDimensionStatus | null
  dimNarrativeTrend: SessionDimensionTrend | null
  dimNarrativeNote: string | null
  dimInterviewPracticeStatus: SessionDimensionStatus | null
  dimInterviewPracticeTrend: SessionDimensionTrend | null
  dimInterviewPracticeNote: string | null
}

// Reads all 21 dimension fields off a submitted LogSessionForm — used by
// logCoachSession (see clients/[token]/[clientId]/actions.ts).
export function parseDimensionFormValues(formData: FormData): DimensionFormValues {
  return {
    dimTargetingStatus: parseStatus(formData, 'targeting'),
    dimTargetingTrend: parseTrend(formData, 'targeting'),
    dimTargetingNote: parseNote(formData, 'targeting'),
    dimMotivationStatus: parseStatus(formData, 'motivation'),
    dimMotivationTrend: parseTrend(formData, 'motivation'),
    dimMotivationNote: parseNote(formData, 'motivation'),
    dimNetworkingStatus: parseStatus(formData, 'networking'),
    dimNetworkingTrend: parseTrend(formData, 'networking'),
    dimNetworkingNote: parseNote(formData, 'networking'),
    dimApplicationVolumeStatus: parseStatus(formData, 'applicationVolume'),
    dimApplicationVolumeTrend: parseTrend(formData, 'applicationVolume'),
    dimApplicationVolumeNote: parseNote(formData, 'applicationVolume'),
    dimSkillsStatus: parseStatus(formData, 'skills'),
    dimSkillsTrend: parseTrend(formData, 'skills'),
    dimSkillsNote: parseNote(formData, 'skills'),
    dimNarrativeStatus: parseStatus(formData, 'narrative'),
    dimNarrativeTrend: parseTrend(formData, 'narrative'),
    dimNarrativeNote: parseNote(formData, 'narrative'),
    dimInterviewPracticeStatus: parseStatus(formData, 'interviewPractice'),
    dimInterviewPracticeTrend: parseTrend(formData, 'interviewPractice'),
    dimInterviewPracticeNote: parseNote(formData, 'interviewPractice'),
  }
}

// Every dimension reading off a session row, in canonical §A5.1 order — the
// shape the pre-session brief and trend-line component both consume.
export function readAllDimensions(session: Pick<CoachSession, keyof CoachSession>): DimensionReading[] {
  return SESSION_DIMENSIONS.map((key) => readDimension(session, key))
}

// Count of "concerning" dimensions (see isDimensionConcerning) on one
// session's reading set — the input to the §A5.1 intervention-suggestion
// rule ("2+ dimensions at-risk/declining").
export function countConcerningDimensions(readings: DimensionReading[]): number {
  return readings.filter(isDimensionConcerning).length
}
