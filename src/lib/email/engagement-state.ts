import type { CandidateEmailKey } from '@prisma/client'

// How recently a member has actually used NextChapter (login, page activity,
// or a check-in), as a basis for how much email they should get. Emails that
// are not followed by a visit are noise, and a member who has gone quiet is
// better served by one note a week than a daily stream.
export type EngagementState = 'active' | 'cooling' | 'dormant'

/** Quiet this long and the member drops to the Monday email only. */
export const COOLING_AFTER_DAYS = 14
/** Quiet this long (the point of the last win-back email) and recurring email stops. */
export const DORMANT_AFTER_DAYS = 63

const DAY = 86_400_000

export function engagementState(lastActivity: Date, now = new Date()): EngagementState {
  const quietDays = Math.floor((now.getTime() - lastActivity.getTime()) / DAY)
  if (quietDays >= DORMANT_AFTER_DAYS) return 'dormant'
  if (quietDays >= COOLING_AFTER_DAYS) return 'cooling'
  return 'active'
}

/** The one rotation email a cooling member keeps: the Monday plan. */
const COOLING_ROTATION: ReadonlySet<CandidateEmailKey> = new Set(['MORNING_MOTIVATION'])

export function rotationAllowedForEngagement(state: EngagementState, emailKey: CandidateEmailKey): boolean {
  if (state === 'dormant') return false
  if (state === 'cooling') return COOLING_ROTATION.has(emailKey)
  return true
}
