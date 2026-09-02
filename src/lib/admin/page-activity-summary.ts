// Derives "time on page" and per-day rollups from a candidate's raw
// CandidatePageActivityEvent PAGE_VIEW rows — no new tracking or schema
// needed for this: DashboardActivityTracker already fires a PAGE_VIEW on
// every route change, so the gap between one page view's timestamp and the
// next IS how long they were on the first page. A gap past
// SESSION_GAP_MS means they left (closed the tab, came back later, or the
// tab just sat idle) rather than actually spending that whole time reading
// the page, so it's excluded rather than attributed.

const ET_TIME_ZONE = 'America/New_York'
const SESSION_GAP_MS = 30 * 60 * 1000 // beyond this, don't attribute the gap as time-on-page

function etDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ET_TIME_ZONE })
}

export interface PageActivityEventInput {
  eventType: 'PAGE_VIEW' | 'LINK_CLICK'
  path: string | null
  createdAt: Date
}

export interface PageSummaryRow {
  path: string
  visits: number
  totalMs: number
}

export interface DaySummaryRow {
  dateKey: string
  pageViews: number
  totalMs: number
}

export interface PageActivitySummary {
  byPage: PageSummaryRow[]
  byDay: DaySummaryRow[]
}

// `events` need not be pre-sorted — sorted internally so callers can pass
// either createdAt order.
export function computePageActivitySummary(events: PageActivityEventInput[]): PageActivitySummary {
  const pageViews = events
    .filter((e): e is PageActivityEventInput & { path: string } => e.eventType === 'PAGE_VIEW' && e.path !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const byPageMap = new Map<string, { visits: number; totalMs: number }>()
  const byDayMap = new Map<string, { pageViews: number; totalMs: number }>()

  for (let i = 0; i < pageViews.length; i++) {
    const current = pageViews[i]
    const dayKey = etDateKey(current.createdAt)

    const pageEntry = byPageMap.get(current.path) ?? { visits: 0, totalMs: 0 }
    pageEntry.visits += 1

    const dayEntry = byDayMap.get(dayKey) ?? { pageViews: 0, totalMs: 0 }
    dayEntry.pageViews += 1

    const next = pageViews[i + 1]
    if (next) {
      const gap = next.createdAt.getTime() - current.createdAt.getTime()
      if (gap > 0 && gap <= SESSION_GAP_MS) {
        pageEntry.totalMs += gap
        dayEntry.totalMs += gap
      }
    }

    byPageMap.set(current.path, pageEntry)
    byDayMap.set(dayKey, dayEntry)
  }

  const byPage = Array.from(byPageMap.entries())
    .map(([path, v]) => ({ path, ...v }))
    .sort((a, b) => b.totalMs - a.totalMs)
  const byDay = Array.from(byDayMap.entries())
    .map(([dateKey, v]) => ({ dateKey, ...v }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)) // most recent day first

  return { byPage, byDay }
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1m'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
