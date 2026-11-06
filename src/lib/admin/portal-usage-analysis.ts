// How members use the candidate portal, from their logged-in page views (CandidatePageActivityEvent).
// Pure functions: the loader in portal-usage.ts feeds them rows.
//
// A visit is one member's run of page views with no gap longer than SESSION_GAP_MS. The data has no
// sign-out or time-on-page, so "where they get hung up" is read from behaviour:
//  - exit: the last page of a visit that had more than one page (they were using the portal and stopped here)
//  - bounce: a one-page visit (they came, looked at this and left)
//  - loop: the same page opened 3 or more times in one visit (looking for something, not finding it)

export const SESSION_GAP_MS = 30 * 60 * 1000
export const LOOP_THRESHOLD = 3
const ET = 'America/New_York'

export interface PortalEvent {
  candidateId: string
  path: string | null
  createdAt: Date
}

export interface PageStat {
  page: string
  views: number
  members: number
  visits: number
  exits: number
  bounces: number
  loops: number
  /** Share of the visits that touched this page and ended on it (after at least one other page). */
  exitRate: number
}

export interface PortalUsage {
  members: number
  visits: number
  pageViews: number
  pagesPerVisit: { average: number; median: number }
  /** Visits by how many pages they had: 1, 2, 3-5, 6-10, 11+. */
  depth: { label: string; visits: number }[]
  /** Visits started per hour of the day (Eastern), weekdays and weekends apart. */
  startsByHour: { weekday: number[]; weekend: number[] }
  /** Days of data in each day type, to turn the counts above into averages. */
  dayCounts: { weekday: number; weekend: number }
  pages: PageStat[]
  /** First pages of one-page visits. */
  bounceLandings: { page: string; count: number }[]
  /** The page a visit most often goes to next, per page, for the pages that lose people. */
  oneVisitShare: number
}

const ID_SEGMENT = /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f-]{27,}|\d{3,})$/i

/** The path without query, hash or trailing slash, with record ids collapsed so /dashboard/jobs/abc123 groups as /dashboard/jobs/:id. */
export function normalizePortalPath(path: string | null): string | null {
  if (!path) return null
  const bare = path.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0]
  if (!bare.startsWith('/')) return null
  const parts = bare.replace(/\/+$/, '').split('/').map((s) => (ID_SEGMENT.test(s) ? ':id' : s.toLowerCase()))
  return parts.join('/') || '/'
}

const etParts = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', hourCycle: 'h23', weekday: 'short' })
const etDay = new Intl.DateTimeFormat('en-CA', { timeZone: ET })

function hourAndWeekend(d: Date): { hour: number; weekend: boolean } {
  const parts = etParts.formatToParts(d)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? ''
  return { hour, weekend: wd === 'Sat' || wd === 'Sun' }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function analyzePortalUsage(events: PortalEvent[], windowDayKeys: string[]): PortalUsage {
  const byMember = new Map<string, { at: number; page: string; date: Date }[]>()
  for (const e of events) {
    const page = normalizePortalPath(e.path)
    if (!page) continue
    const list = byMember.get(e.candidateId) ?? []
    list.push({ at: e.createdAt.getTime(), page, date: e.createdAt })
    byMember.set(e.candidateId, list)
  }

  const stats = new Map<string, { views: number; members: Set<string>; visits: number; exits: number; bounces: number; loops: number }>()
  const stat = (page: string) => {
    let s = stats.get(page)
    if (!s) {
      s = { views: 0, members: new Set(), visits: 0, exits: 0, bounces: 0, loops: 0 }
      stats.set(page, s)
    }
    return s
  }
  const startsWeekday = new Array<number>(24).fill(0)
  const startsWeekend = new Array<number>(24).fill(0)
  const pageCounts: number[] = []
  const bounceLandings = new Map<string, number>()
  let pageViews = 0

  for (const [member, list] of byMember) {
    list.sort((a, b) => a.at - b.at)
    let run: typeof list = []
    const closeRun = () => {
      if (run.length === 0) return
      pageCounts.push(run.length)
      const { hour, weekend } = hourAndWeekend(run[0].date)
      ;(weekend ? startsWeekend : startsWeekday)[hour] += 1
      const seen = new Map<string, number>()
      for (const v of run) seen.set(v.page, (seen.get(v.page) ?? 0) + 1)
      for (const [page, n] of seen) {
        const s = stat(page)
        s.visits += 1
        if (n >= LOOP_THRESHOLD) s.loops += 1
      }
      const last = run[run.length - 1].page
      if (run.length === 1) {
        stat(last).bounces += 1
        bounceLandings.set(last, (bounceLandings.get(last) ?? 0) + 1)
      } else {
        stat(last).exits += 1
      }
      run = []
    }
    for (const v of list) {
      if (run.length > 0 && v.at - run[run.length - 1].at > SESSION_GAP_MS) closeRun()
      run.push(v)
      const s = stat(v.page)
      s.views += 1
      s.members.add(member)
      pageViews += 1
    }
    closeRun()
  }

  const visits = pageCounts.length
  const bucket = (lo: number, hi: number) => pageCounts.filter((n) => n >= lo && n <= hi).length
  const dayCounts = { weekday: 0, weekend: 0 }
  for (const key of windowDayKeys) {
    const wd = new Date(`${key}T12:00:00-05:00`).getUTCDay()
    if (wd === 0 || wd === 6) dayCounts.weekend += 1
    else dayCounts.weekday += 1
  }

  const pages: PageStat[] = Array.from(stats, ([page, s]) => ({
    page,
    views: s.views,
    members: s.members.size,
    visits: s.visits,
    exits: s.exits,
    bounces: s.bounces,
    loops: s.loops,
    exitRate: s.visits ? s.exits / s.visits : 0,
  })).sort((a, b) => b.views - a.views)

  return {
    members: byMember.size,
    visits,
    pageViews,
    pagesPerVisit: { average: visits ? pageViews / visits : 0, median: median(pageCounts) },
    depth: [
      { label: '1 page', visits: bucket(1, 1) },
      { label: '2 pages', visits: bucket(2, 2) },
      { label: '3 to 5', visits: bucket(3, 5) },
      { label: '6 to 10', visits: bucket(6, 10) },
      { label: '11 or more', visits: bucket(11, Infinity) },
    ],
    startsByHour: { weekday: startsWeekday, weekend: startsWeekend },
    dayCounts,
    pages,
    bounceLandings: Array.from(bounceLandings, ([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count),
    oneVisitShare: visits ? bucket(1, 1) / visits : 0,
  }
}

/** Pages that lose people: enough traffic to mean something, ranked by how often a visit ends there. */
export function stuckPages(pages: PageStat[], minVisits = 10): PageStat[] {
  return pages
    .filter((p) => p.visits >= minVisits && (p.exits > 0 || p.loops > 0))
    .sort((a, b) => b.exitRate - a.exitRate || b.exits - a.exits)
}

export function etDayKey(d: Date): string {
  return etDay.format(d)
}
