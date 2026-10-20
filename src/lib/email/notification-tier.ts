import type { CandidateEmailKey, NotificationTier } from '@prisma/client'

// Gates every recurring candidate email (the 7-day weekly cadence run by
// candidate-email-dispatch, plus the older once-a-week extras below) by
// tier — MINIMAL opts out of all of them, FULL and ESSENTIALS get the same
// calendar. Core/transactional emails (Market Reality Report, registration
// reminders) are NOT gated by this — they send regardless of tier.
export function shouldSendWeeklyExtraForTier(tier: NotificationTier): boolean {
  return tier !== 'MINIMAL'
}

/** The rotation emails an ESSENTIALS member still gets: the Monday plan and the Thursday midweek check-in. */
const ESSENTIALS_ROTATION: ReadonlySet<CandidateEmailKey> = new Set(['MORNING_MOTIVATION', 'MIDWEEK_CHECKIN'])

/**
 * Whether a member's tier gets this rotation email (the weekday emails run by
 * candidate-email-dispatch). FULL gets every active one, ESSENTIALS only
 * Monday and Thursday, MINIMAL none.
 */
export function shouldSendRotationEmail(tier: NotificationTier, emailKey: CandidateEmailKey): boolean {
  if (tier === 'MINIMAL') return false
  if (tier === 'ESSENTIALS') return ESSENTIALS_ROTATION.has(emailKey)
  return true
}
