/**
 * Whether a daily email goes out today, given an optional list of weekdays ("1,3,5", 0 = Sunday, UTC).
 * Unset or empty means every day. An unreadable value also means every day, so a typo never silences the email.
 */
export function sendsToday(days: string | undefined, now: Date): boolean {
  const list = (days ?? '').split(',').map((d) => d.trim()).filter(Boolean)
  if (!list.length) return true
  const valid = list.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  if (!valid.length) return true
  return valid.includes(now.getUTCDay())
}
