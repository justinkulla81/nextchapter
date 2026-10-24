// Free upkeep for the events catalog: plain HTTP checks and text parsing, no paid API and no model calls.
//   1. Past editions: when an event's dates have passed, dates are cleared (the usual month stays) so the page never
//      shows a finished event as upcoming.
//   2. Link check: every published event's page is fetched on a rotation; dead links count up and hide the event after
//      three misses; a page that is blocking bots is left alone.
//   3. New dates: when the page names exactly one future date range and we hold none, we take it.
// Pure helpers are here; the runner (run-refresh.ts) does the fetching and writing.

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}
const MONTH_RE = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export interface DateRange { start: string; end: string }

/** Every "March 14-16, 2027" / "Mar 14 – Apr 2, 2027" / "June 3, 2027" in the text that falls in the future window. */
export function extractDateRanges(text: string, now = new Date(), horizonDays = 800): DateRange[] {
  const out = new Map<string, DateRange>()
  const flat = text.replace(/\s+/g, ' ')
  const add = (y: number, m1: number, d1: number, m2: number, d2: number) => {
    const s = utc(y, m1, d1)
    const e = utc(y, m2, d2)
    if (e < s || s.getUTCMonth() !== m1 || e.getUTCMonth() !== m2) return
    if (e.getTime() - s.getTime() > 14 * 86_400_000) return
    if (s.getTime() < now.getTime() || s.getTime() - now.getTime() > horizonDays * 86_400_000) return
    out.set(isoDay(s) + isoDay(e), { start: isoDay(s), end: isoDay(e) })
  }
  const mon = (s: string) => MONTHS[s.replace('.', '').toLowerCase()]
  // March 14-16, 2027  /  March 14 to 16, 2027
  for (const m of flat.matchAll(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})\\s*(?:-|\\u2013|\\u2014|to|through)\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, 'gi')))
    add(+m[4], mon(m[1]), +m[2], mon(m[1]), +m[3])
  // March 30 - April 2, 2027
  for (const m of flat.matchAll(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})\\s*(?:-|\\u2013|\\u2014|to|through)\\s*(${MONTH_RE})\\s+(\\d{1,2}),?\\s+(20\\d\\d)\\b`, 'gi')))
    add(+m[5], mon(m[1]), +m[2], mon(m[3]), +m[4])
  // 14-16 March 2027
  for (const m of flat.matchAll(new RegExp(`\\b(\\d{1,2})\\s*(?:-|\\u2013|\\u2014|to)\\s*(\\d{1,2})\\s+(${MONTH_RE}),?\\s+(20\\d\\d)\\b`, 'gi')))
    add(+m[4], mon(m[3]), +m[1], mon(m[3]), +m[2])
  // single day: June 3, 2027
  for (const m of flat.matchAll(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, 'gi')))
    add(+m[3], mon(m[1]), +m[2], mon(m[1]), +m[2])
  const all = [...out.values()]
  // A single day inside a longer range ("Apr 2" in "Mar 30 - Apr 2") is part of that range, not another date.
  const kept = all.filter((r) => r.start !== r.end || !all.some((o) => o.start !== o.end && o.start <= r.start && r.end <= o.end))
  return kept.sort((a, b) => a.start.localeCompare(b.start))
}

/** Pick the new dates only when the page is unambiguous: one multi-day range, or one range that contains the others as single days. */
export function pickNewDates(ranges: DateRange[]): DateRange | null {
  const multi = ranges.filter((r) => r.start !== r.end)
  if (multi.length === 1) return multi[0]
  // The same event listed with day-by-day schedule: the single days all fall inside one range.
  if (multi.length === 0 && ranges.length === 1) return ranges[0]
  return null
}

export type LinkStatus = 'OK' | 'BROKEN' | 'BLOCKED' | 'ERROR'

export function classifyHttp(status: number | null): LinkStatus {
  if (status == null) return 'ERROR'
  if (status >= 200 && status < 400) return 'OK'
  if (status === 404 || status === 410) return 'BROKEN'
  if (status === 401 || status === 403 || status === 429 || status === 451 || status === 503) return 'BLOCKED'
  if (status >= 500) return 'ERROR'
  return 'ERROR'
}

export const HIDE_AFTER_FAILURES = 3

/** Visible text of an HTML page, tags and scripts removed. */
export function visibleText(html: string, max = 120_000): string {
  return html
    .slice(0, 600_000)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .slice(0, max)
}
