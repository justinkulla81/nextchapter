// Turns a story into positions on a time axis. Pure and client-safe. The same numbers draw the
// desktop timeline, the printable report version and the phone list's ordering.

import { parseIso, type StoryEvent, type StoryKind } from './events'

export type LaneId = 'school' | 'work' | 'ventures' | 'pauses' | 'learning' | 'moments'

export const LANES: { id: LaneId; label: string; kinds: StoryKind[] }[] = [
  { id: 'school', label: 'School', kinds: ['SCHOOL'] },
  { id: 'work', label: 'Work', kinds: ['WORK'] },
  { id: 'ventures', label: 'Your own ventures', kinds: ['VENTURE'] },
  { id: 'pauses', label: 'Pauses', kinds: ['PAUSE'] },
  { id: 'learning', label: 'Learning', kinds: ['LEARNING'] },
  { id: 'moments', label: 'Moments', kinds: ['MILESTONE'] },
]

const YEAR = 365.25 * 86_400_000
export const yearOf = (d: Date) => 1970 + d.getTime() / YEAR

export type Bar = { event: StoryEvent; leftPct: number; widthPct: number; point: boolean; ongoing: boolean }
export type LaneLayout = { id: LaneId; label: string; rows: Bar[][] }
export type Tick = { pct: number; label: string }

export type Layout = {
  startYear: number
  endYear: number
  todayPct: number
  ticks: Tick[]
  lanes: LaneLayout[]
}

export function layoutStory(events: StoryEvent[], now: Date, opts: { hideYears?: boolean } = {}): Layout {
  const today = yearOf(now)
  const starts = events.map((e) => yearOf(parseIso(e.start)))
  const first = starts.length ? Math.min(...starts) : today - 5
  const startYear = Math.floor(first)
  // Room to the right for the next chapter, and never a cramped axis.
  const endYear = Math.max(Math.ceil(today + 3.2), startYear + 10)
  const span = endYear - startYear
  const pct = (y: number) => Math.min(100, Math.max(0, ((y - startYear) / span) * 100))

  const step = span <= 12 ? 2 : span <= 24 ? 4 : 5
  const ticks: Tick[] = []
  for (let y = startYear, i = 0; y <= endYear; y += step, i++) {
    ticks.push({ pct: pct(y), label: opts.hideYears ? (i === 0 ? 'Start' : `+${y - startYear} yrs`) : String(y) })
  }

  const lanes: LaneLayout[] = []
  for (const lane of LANES) {
    const bars: Bar[] = events
      .filter((e) => lane.kinds.includes(e.kind))
      .map((event) => {
        const a = yearOf(parseIso(event.start))
        const point = event.kind === 'LEARNING' || event.kind === 'MILESTONE'
        const ongoing = !point && event.end === null
        const b = point ? a : yearOf(event.end ? parseIso(event.end) : now)
        return { event, leftPct: pct(a), widthPct: point ? 0 : Math.max(pct(b) - pct(a), 0.6), point, ongoing }
      })
      .sort((x, y) => x.leftPct - y.leftPct)
    if (bars.length === 0 && lane.id !== 'work') continue
    // Overlapping bars share a lane on separate rows.
    const rows: Bar[][] = []
    const rowEnds: number[] = []
    for (const bar of bars) {
      const need = bar.point ? bar.leftPct + 8 : bar.leftPct + bar.widthPct
      let r = rowEnds.findIndex((end) => end <= bar.leftPct + 0.01)
      if (r === -1) {
        r = rows.length
        rows.push([])
        rowEnds.push(0)
      }
      rows[r].push(bar)
      rowEnds[r] = need
    }
    lanes.push({ id: lane.id, label: lane.label, rows: rows.length ? rows : [[]] })
  }
  return { startYear, endYear, todayPct: pct(today), ticks, lanes }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthYear = (s: string) => {
  const d = parseIso(s)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function durationText(startIso: string, endIso: string | null, now: Date, approx = false): string {
  const a = parseIso(startIso)
  const b = endIso ? parseIso(endIso) : now
  const months = Math.max(1, Math.round((b.getTime() - a.getTime()) / (30.44 * 86_400_000)))
  const pre = approx ? 'about ' : months >= 12 ? 'about ' : 'about '
  if (months < 12) return `${pre}${months} ${months === 1 ? 'month' : 'months'}`
  const years = Math.round((months / 12) * 2) / 2
  return `${pre}${years === 1 ? '1 year' : `${years} years`}`
}

// "Jan 2024 to today", or, for someone who prefers not to show years, "about 3 years so far".
export function whenText(e: StoryEvent, now: Date, hideYears: boolean): string {
  const point = e.kind === 'LEARNING' || e.kind === 'MILESTONE'
  if (point) return hideYears ? (e.kind === 'LEARNING' ? 'Learning' : 'A moment in your story') : monthYear(e.start)
  if (hideYears) return e.end ? durationText(e.start, e.end, now, e.approx) : `${durationText(e.start, null, now)} so far`
  return `${e.approx ? 'Around ' : ''}${monthYear(e.start)} to ${e.end ? monthYear(e.end) : 'today'}`
}
