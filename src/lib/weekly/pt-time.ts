// DST-aware Pacific Time helpers. Vercel Cron runs in UTC and PT crosses DST
// twice a year, so a fixed -7/-8 offset would drift by an hour for roughly
// half the year — this reads the actual PT wall-clock via Intl instead.

const PT_ZONE = 'America/Los_Angeles'

// Returns a Date whose UTC getters (getUTCHours, getUTCDay, etc.) reflect
// the current wall-clock time in Pacific — a standard trick for doing
// date-boundary math in a specific timezone without a library.
export function nowInPacific(reference: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(reference)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  // "24" shows up at midnight with hour12: false in some engines — normalize.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  const second = Number(get('second'))

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

// The Sprint commitment for the week starting `weekStartDate` (a Monday) is
// only editable Saturday midnight PT through Monday midnight PT of that
// same week's start — i.e. the weekend immediately before it begins. Outside
// that window it's locked for the week.
export function isSprintEditWindowOpen(weekStartDate: Date, reference: Date = new Date()): boolean {
  const pt = nowInPacific(reference)
  const windowOpen = new Date(weekStartDate)
  windowOpen.setUTCDate(windowOpen.getUTCDate() - 2) // Saturday before the Monday start
  windowOpen.setUTCHours(0, 0, 0, 0)
  const windowClose = new Date(weekStartDate)
  windowClose.setUTCHours(0, 0, 0, 0)

  return pt >= windowOpen && pt < windowClose
}

export function isMondayMidnightPTPassed(weekStartDate: Date, reference: Date = new Date()): boolean {
  const pt = nowInPacific(reference)
  const windowClose = new Date(weekStartDate)
  windowClose.setUTCHours(0, 0, 0, 0)
  return pt >= windowClose
}
