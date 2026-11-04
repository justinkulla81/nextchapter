import { perDaySeriesFromCounts, perHourSeriesFromCounts, type BucketCount } from '@/lib/admin/visitor-time-buckets'

// Series for the Visitor activity charts that split human page views into segments (candidate and B2B portal use,
// traffic from social, LinkedIn and email). Each segment gets a total (page views) and a unique count (distinct IPs
// in the bucket, the same dedupe the main traffic chart uses), for the four ranges the range buttons offer.

export type SegmentRange = 'day' | '7d' | '30d' | 'all'

export interface SegmentCountRow {
  /** ET day "YYYY-MM-DD" or ET hour "YYYY-MM-DD HH". */
  key: string
  ip: string | null
  views: number
}

export interface SegmentTally {
  views: Map<string, number>
  visitors: Map<string, number>
}

/** Rows are one (bucket, IP) pair each, already limited to one segment. Events with no IP count as views but not as visitors. */
export function tallySegment(rows: SegmentCountRow[]): SegmentTally {
  const views = new Map<string, number>()
  const ips = new Map<string, Set<string>>()
  for (const r of rows) {
    views.set(r.key, (views.get(r.key) ?? 0) + r.views)
    if (!r.ip) continue
    const set = ips.get(r.key) ?? new Set<string>()
    set.add(r.ip)
    ips.set(r.key, set)
  }
  return { views, visitors: new Map(Array.from(ips, ([key, set]) => [key, set.size] as const)) }
}

export type RangeBuckets = Record<SegmentRange, BucketCount[]>

/** Total and unique series for one segment, per range. `dayRows` span all time, `hourRows` at least the last 24 hours. */
export function segmentRangeSeries(
  dayRows: SegmentCountRow[],
  hourRows: SegmentCountRow[],
  now: Date,
  allTimeDays: number
): { views: RangeBuckets; visitors: RangeBuckets } {
  const day = tallySegment(dayRows)
  const hour = tallySegment(hourRows)
  const build = (pick: 'views' | 'visitors'): RangeBuckets => ({
    day: perHourSeriesFromCounts(hour[pick], now, 24),
    '7d': perDaySeriesFromCounts(day[pick], now, 7),
    '30d': perDaySeriesFromCounts(day[pick], now, 30),
    all: perDaySeriesFromCounts(day[pick], now, allTimeDays),
  })
  return { views: build('views'), visitors: build('visitors') }
}
