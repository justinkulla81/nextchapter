// A company's layoff history and whether it has started hiring again. Pure, tested in
// src/test/company-intel-panels.test.ts.
//
// Honest about what it can see: our posting history only begins when the board did, so
// "hiring since" is computed only for notices filed after that. For an earlier notice
// the page says it predates our tracking, rather than implying nothing was posted.

const DAY_MS = 24 * 60 * 60 * 1000

export interface LayoffNotice {
  noticeDate: Date
  employees: number | null
  layoffType: string | null
  sourceUrl: string | null
}

export interface LayoffEvent extends LayoffNotice {
  /** Postings first seen after this notice. null when the notice predates our tracking. */
  postedSince: number | null
  /** Most-posted functions since, best first. */
  topFunctionsSince: string[]
}

export type RecoveryStatus = 'none' | 'recent_cut' | 'hiring_again' | 'quiet' | 'before_tracking'

export interface LayoffTimeline {
  events: LayoffEvent[]
  totalEmployees: number
  status: RecoveryStatus
}

export const RECENT_CUT_DAYS = 60
export const HIRING_AGAIN_MIN_POSTINGS = 3

export function buildLayoffTimeline(input: {
  notices: LayoffNotice[]
  postings: { createdAt: Date; function: string | null }[]
  /** When the board's posting history begins (earliest posting we have seen). */
  trackingStart: Date | null
  now?: Date
}): LayoffTimeline {
  const now = (input.now ?? new Date()).getTime()
  const sorted = [...input.notices].sort((a, b) => b.noticeDate.getTime() - a.noticeDate.getTime())

  const events: LayoffEvent[] = sorted.map((n) => {
    const tracked = input.trackingStart !== null && n.noticeDate.getTime() >= input.trackingStart.getTime()
    if (!tracked) return { ...n, postedSince: null, topFunctionsSince: [] }
    const since = input.postings.filter((p) => p.createdAt.getTime() > n.noticeDate.getTime())
    const counts = new Map<string, number>()
    for (const p of since) if (p.function) counts.set(p.function, (counts.get(p.function) ?? 0) + 1)
    return {
      ...n,
      postedSince: since.length,
      topFunctionsSince: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
    }
  })

  let status: RecoveryStatus = 'none'
  const latest = events[0]
  if (latest) {
    const ageDays = (now - latest.noticeDate.getTime()) / DAY_MS
    if (latest.postedSince === null) status = 'before_tracking'
    else if (latest.postedSince >= HIRING_AGAIN_MIN_POSTINGS) status = 'hiring_again'
    else status = ageDays <= RECENT_CUT_DAYS ? 'recent_cut' : 'quiet'
  }

  return {
    events,
    totalEmployees: sorted.reduce((s, n) => s + (n.employees ?? 0), 0),
    status,
  }
}
