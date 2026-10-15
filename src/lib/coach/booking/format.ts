/** "9:00 AM" for a count of minutes from midnight; 1440 reads as "12:00 AM (end of day)". */
export function formatMinute(minute: number): string {
  if (minute >= 24 * 60) return '12:00 AM (end of day)'
  const h = Math.floor(minute / 60)
  const m = minute % 60
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Half-hour steps for the weekly hours pickers. */
export const START_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30)
export const END_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 30)
