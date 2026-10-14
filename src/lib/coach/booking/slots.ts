/**
 * Open booking slots for a coach. Pure: everything it needs is passed in, so the time
 * zone and daylight-saving handling can be tested without a clock or a database.
 *
 * A coach writes weekly hours in their own time zone ("Mon 9:00 to 17:00 New York").
 * To turn that into real instants for a specific date we find the zone's UTC offset
 * for that date with Intl, so hours stay at the same wall-clock time across the
 * spring and autumn clock changes.
 */
export interface BookingSettings {
  timezone: string
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
}

export interface AvailabilityWindow {
  weekday: number // 0 = Sunday .. 6 = Saturday, in the coach's zone
  startMinute: number // minutes from local midnight
  endMinute: number
}

export interface BusyInterval {
  startsAt: Date
  endsAt: Date
}

const MINUTE = 60_000

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, f)
  }
  return f
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone)
    return true
  } catch {
    return false
  }
}

/** The wall-clock reading in `timeZone` at an instant. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Minutes the zone is ahead of UTC at an instant (negative for the Americas). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - instant.getTime()) / MINUTE)
}

/**
 * The instant at which the clock in `timeZone` reads the given wall time. A time that
 * does not exist (skipped by the spring clock change) resolves to the moment just
 * after the gap; an ambiguous one (repeated in autumn) resolves to the first occurrence.
 */
export function zonedWallTimeToInstant(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay)
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * MINUTE
  // The offset at the guess can differ from the offset at the naive time across a clock change.
  const corrected = naive - offsetMinutes(new Date(guess), timeZone) * MINUTE
  if (corrected !== guess) guess = corrected
  return new Date(guess)
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function generateSlots(input: {
  settings: BookingSettings
  windows: AvailabilityWindow[]
  busy: BusyInterval[]
  now: Date
}): Date[] {
  const { settings, windows, busy, now } = input
  const slotMs = settings.slotMinutes * MINUTE
  const bufferMs = settings.bufferMinutes * MINUTE
  const earliest = now.getTime() + settings.minNoticeHours * 60 * MINUTE
  const today = zonedParts(now, settings.timezone)
  const slots: Date[] = []

  // Walk calendar dates in the coach's zone: today through `maxDaysAhead` days from today.
  for (let d = 0; d <= settings.maxDaysAhead; d++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + d))
    const y = date.getUTCFullYear()
    const m = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    const weekday = weekdayOf(y, m, day)

    for (const w of windows) {
      if (w.weekday !== weekday || w.endMinute <= w.startMinute) continue
      const windowEnd = zonedWallTimeToInstant(y, m, day, w.endMinute, settings.timezone).getTime()
      let start = zonedWallTimeToInstant(y, m, day, w.startMinute, settings.timezone).getTime()
      while (start + slotMs <= windowEnd) {
        const end = start + slotMs
        const free =
          start >= earliest &&
          // A booking blocks its own time plus the buffer after it, and the buffer before the next one.
          !busy.some((b) => start < b.endsAt.getTime() + bufferMs && end + bufferMs > b.startsAt.getTime())
        if (free) slots.push(new Date(start))
        start += slotMs
      }
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime())
}

/** True if `startsAt` is one of the currently open slots. Booking re-checks this under a lock. */
export function isOpenSlot(startsAt: Date, input: Parameters<typeof generateSlots>[0]): boolean {
  return generateSlots(input).some((s) => s.getTime() === startsAt.getTime())
}

export const SLOT_MINUTE_CHOICES = [30, 45, 60] as const
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
