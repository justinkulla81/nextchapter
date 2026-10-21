// Client-safe constants and pure helpers for the recruiting calendar and early-career
// roles (the data layer is recruiting.ts, which is server-only).

export const RECRUITING_DATE_KINDS = ['CAREER_FAIR', 'INFO_SESSION', 'ON_CAMPUS_INTERVIEWS', 'APPLICATION_DEADLINE', 'OTHER'] as const
export type RecruitingDateKind = (typeof RECRUITING_DATE_KINDS)[number]
export const RECRUITING_DATE_LABELS: Record<RecruitingDateKind, string> = {
  CAREER_FAIR: 'Career fair',
  INFO_SESSION: 'Info session',
  ON_CAMPUS_INTERVIEWS: 'On-campus interviews',
  APPLICATION_DEADLINE: 'Application deadline',
  OTHER: 'Other',
}

export const EARLY_CAREER_KINDS = ['INTERNSHIP', 'CO_OP', 'ENTRY_LEVEL'] as const
export type EarlyCareerKind = (typeof EARLY_CAREER_KINDS)[number]
export const EARLY_CAREER_LABELS: Record<EarlyCareerKind, string> = {
  INTERNSHIP: 'Internship',
  CO_OP: 'Co-op',
  ENTRY_LEVEL: 'Entry-level job',
}

/** The URL if it is http(s), else null: a staff-entered link is shown to people, so no javascript: or data: URLs. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Dates from today on come first, soonest first; past dates follow, most recent first. */
export function splitUpcoming<T extends { startsAt: Date }>(rows: T[], now = new Date()): { upcoming: T[]; past: T[] } {
  const t = now.getTime()
  return {
    upcoming: rows.filter((r) => r.startsAt.getTime() >= t).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    past: rows.filter((r) => r.startsAt.getTime() < t).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
  }
}

/** Whether an application deadline has passed (end of that day counts as open). */
export function deadlinePassed(deadline: Date | null, now = new Date()): boolean {
  if (!deadline) return false
  return deadline.getTime() + 24 * 3_600_000 <= now.getTime()
}
