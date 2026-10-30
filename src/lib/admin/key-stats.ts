import { classifyUserAgent } from '@/lib/http/user-agent'
import { isJobPostingPath, pathOnly } from '@/lib/admin/visitor-analytics'

// Pure daily rollup behind the "Key stats over time" section of the admin Visitors page. Public page views only
// (HomepageVisitEvent PAGE_VIEW rows, human traffic). A "visitor" is an IP address on one Eastern-time day, the same
// dedupe the rest of the page uses. Sign-ups and Market Reality come from other tables and are merged in by the caller.

export interface KeyStatsEvent {
  createdAt: Date
  ip: string | null
  path: string | null
  userAgent: string | null
  country: string | null
}

export interface KeyStatsDay {
  dateKey: string
  homepageVisitors: number
  reportsVisitors: number
  jobsViews: number
  nonJobsViews: number
  jobsPages: number
  nonJobsPages: number
  usVisitors: number
  internationalVisitors: number
  unknownCountryVisitors: number
  visitors: number
}

export function isJobsSectionPath(path: string | null): boolean {
  const p = pathOnly(path)
  return p === '/jobs' || isJobPostingPath(p)
}

export function isReportsPath(path: string | null): boolean {
  const p = pathOnly(path)
  return p === '/reports' || p.startsWith('/reports/')
}

export function nonJobsShare(day: Pick<KeyStatsDay, 'jobsViews' | 'nonJobsViews'>): number | null {
  const total = day.jobsViews + day.nonJobsViews
  return total === 0 ? null : day.nonJobsViews / total
}

export function buildKeyStats(events: KeyStatsEvent[], options: { dayKey: (d: Date) => string; dateKeys: string[] }): KeyStatsDay[] {
  type Acc = {
    home: Set<string>
    reports: Set<string>
    all: Set<string>
    country: Map<string, string | null>
    jobsViews: number
    nonJobsViews: number
    jobsPaths: Set<string>
    nonJobsPaths: Set<string>
  }
  const byDay = new Map<string, Acc>()
  for (const key of options.dateKeys) {
    byDay.set(key, { home: new Set(), reports: new Set(), all: new Set(), country: new Map(), jobsViews: 0, nonJobsViews: 0, jobsPaths: new Set(), nonJobsPaths: new Set() })
  }
  for (const e of events) {
    if (!e.ip || classifyUserAgent(e.userAgent) !== 'human') continue
    const acc = byDay.get(options.dayKey(e.createdAt))
    if (!acc) continue
    const p = pathOnly(e.path)
    acc.all.add(e.ip)
    if (e.country && !acc.country.get(e.ip)) acc.country.set(e.ip, e.country.toUpperCase())
    else if (!acc.country.has(e.ip)) acc.country.set(e.ip, null)
    if (p === '/') acc.home.add(e.ip)
    if (isReportsPath(p)) acc.reports.add(e.ip)
    if (isJobsSectionPath(p)) {
      acc.jobsViews++
      acc.jobsPaths.add(p)
    } else {
      acc.nonJobsViews++
      acc.nonJobsPaths.add(p)
    }
  }
  return options.dateKeys.map((dateKey) => {
    const a = byDay.get(dateKey) as Acc
    let us = 0
    let intl = 0
    let unknown = 0
    for (const c of a.country.values()) {
      if (!c) unknown++
      else if (c === 'US') us++
      else intl++
    }
    return {
      dateKey,
      homepageVisitors: a.home.size,
      reportsVisitors: a.reports.size,
      jobsViews: a.jobsViews,
      nonJobsViews: a.nonJobsViews,
      jobsPages: a.jobsPaths.size,
      nonJobsPages: a.nonJobsPaths.size,
      usVisitors: us,
      internationalVisitors: intl,
      unknownCountryVisitors: unknown,
      visitors: a.all.size,
    }
  })
}
