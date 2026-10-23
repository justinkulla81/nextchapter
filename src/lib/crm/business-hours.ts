const TZ = 'America/New_York'

/** First and last hour (Eastern, 24h) a scheduled sweep runs: 7:00 up to 19:59. */
export const SWEEP_FIRST_HOUR = 7
export const SWEEP_LAST_HOUR = 19

/**
 * Whether `at` falls in business hours — Monday to Friday, 7:00 to 19:59
 * Eastern, daylight saving included. The scheduled CRM sweep only runs then;
 * the first run each morning reaches back over the night and weekend, so
 * nothing is missed by skipping the hours nobody is looking.
 */
export function isSweepHours(at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(at)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1')
  return !['Sat', 'Sun'].includes(weekday) && hour >= SWEEP_FIRST_HOUR && hour <= SWEEP_LAST_HOUR
}
