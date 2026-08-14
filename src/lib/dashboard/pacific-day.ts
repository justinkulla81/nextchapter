// Day boundary for the Daily Message "dismiss for today" and Action Plan
// "minimize for today" behaviors — these need to reset at 12:01am Pacific,
// not UTC midnight (see startOfUTCDay in lib/daily/mood.ts, used for mood
// check-in streaks, which intentionally stays UTC-scoped and is untouched
// here). Computed via Intl rather than a fixed UTC-7/8 offset so it stays
// correct across the PST/PDT transition.
export function startOfPacificDay(d: Date = new Date()): Date {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = Number(dateParts.find((p) => p.type === 'year')!.value)
  const month = Number(dateParts.find((p) => p.type === 'month')!.value)
  const day = Number(dateParts.find((p) => p.type === 'day')!.value)

  const offsetLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')!.value // e.g. "GMT-7" or "GMT-8"
  const offsetHours = Number(offsetLabel.replace('GMT', '')) || -8

  // Midnight Pacific on (year, month, day) expressed as a UTC instant —
  // UTC-midnight-on-that-date minus the (negative) Pacific offset pushes it
  // forward by 7 or 8 hours, landing on the correct UTC instant.
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetHours * 60 * 60 * 1000)
}
