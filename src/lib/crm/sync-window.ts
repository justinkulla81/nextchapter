// How far back the scheduled Gmail sweep (src/app/api/cron/crm-sync/route.ts) reaches, kept pure so it can be tested.

const HOUR = 3_600_000
/** Slack past the last clean sweep, for mail Gmail dates a little before it shows up. */
export const GMAIL_WINDOW_MARGIN_HOURS = 6
/** Never reach back further than this, however long the outage. */
export const GMAIL_WINDOW_MAX_DAYS = 14

/**
 * The window in days (fractional) for a scheduled sweep: from the start of the last clean sweep, plus a margin, and never less than
 * one interval plus the margin. No clean sweep on record reaches back the maximum.
 *
 * It used to be at least two whole days. With an hourly interval every message was re-read about 48 times, and once outreach mail
 * pushed the two days to ~1,260 messages a sweep took ~290 s; from 2026-11-18 00:00 UTC every run hit the 300 s limit, and since none
 * finished cleanly the window only grew.
 */
export function scheduledGmailWindowDays(intervalHours: number, lastOkStartedAt: Date | null, now = Date.now()): number {
  if (!lastOkStartedAt) return GMAIL_WINDOW_MAX_DAYS
  const sinceOkHours = Math.max(0, (now - lastOkStartedAt.getTime()) / HOUR)
  const hours = Math.max(intervalHours, sinceOkHours) + GMAIL_WINDOW_MARGIN_HOURS
  return Math.min(GMAIL_WINDOW_MAX_DAYS, hours / 24)
}
