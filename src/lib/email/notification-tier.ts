import type { NotificationTier } from '@prisma/client'

// Gates every recurring candidate email (the 7-day weekly cadence run by
// candidate-email-dispatch, plus the older once-a-week extras below) by
// tier — MINIMAL opts out of all of them, FULL and ESSENTIALS get the same
// calendar. Core/transactional emails (Hireability Report, registration
// reminders) are NOT gated by this — they send regardless of tier.
export function shouldSendWeeklyExtraForTier(tier: NotificationTier): boolean {
  return tier !== 'MINIMAL'
}
