import type { NotificationTier } from '@prisma/client'

// Gates the recurring daily nudge email by tier. Core/transactional emails
// (Hireability Report, registration reminders) are NOT gated by this — they
// send regardless of tier, matching the "core stays on" split from the
// email cadence plan.
export function shouldSendDailyEmailForTier(tier: NotificationTier, date: Date): boolean {
  if (tier === 'MINIMAL') return false
  if (tier === 'FULL') return true
  // ESSENTIALS: Monday and Thursday only (UTC day-of-week: 1 = Mon, 4 = Thu).
  const day = date.getUTCDay()
  return day === 1 || day === 4
}
