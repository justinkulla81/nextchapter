import type { NotificationTier } from '@prisma/client'

// Gates the recurring daily nudge email by tier. Core/transactional emails
// (Hireability Report, registration reminders) are NOT gated by this — they
// send regardless of tier, matching the "core stays on" split from the
// email cadence plan.
export function shouldSendDailyEmailForTier(tier: NotificationTier, date: Date): boolean {
  if (tier === 'MINIMAL') return false
  const day = date.getUTCDay()
  // Monday already carries the weekly kickoff email ("Your new week is set")
  // from auto-assign-sprint — the daily nudge would be a same-morning
  // duplicate touchpoint on top of it, for every tier.
  if (day === 1) return false
  if (tier === 'FULL') return true
  // ESSENTIALS: Tuesday and Thursday (UTC day-of-week: 2 = Tue, 4 = Thu).
  return day === 2 || day === 4
}

// Gates the two once-a-week extras (the Friday gap nudge, the Community &
// Coaching digest) — unlike the daily nudge these already only fire once a
// week, so there's no day-of-week split to make: Full/Essentials get them,
// Minimal doesn't.
export function shouldSendWeeklyExtraForTier(tier: NotificationTier): boolean {
  return tier !== 'MINIMAL'
}
