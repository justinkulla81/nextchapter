import { classifyDevice, type DeviceClass } from '@/lib/http/device'
import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

// Pure aggregation over HomepageVisitEvent rows for the admin Visitors report.
// A "visitor" is an IP address (the same dedupe the existing unique-visitors
// chart uses — there is no cookie id on these events), and a "visitor-day" is
// one IP on one Eastern-time calendar day. Callers pass human traffic only.

export interface VisitEvent {
  createdAt: Date
  eventType: 'PAGE_VIEW' | 'LINK_CLICK'
  path: string | null
  href: string | null
  referrer: string | null
  userAgent: string | null
  ip: string | null
  candidateId?: string | null
}

export interface Counted {
  label: string
  count: number
}

export interface PersonRow {
  ip: string
  distinctPages: number
  pageViews: number
  linkClicks: number
  lastSeen: Date
  candidateId: string | null
  topPages: string[]
}

export interface VisitorAnalytics {
  visitors: number
  visitorDays: number
  pageViews: number
  linkClicks: number
  device: { overall: Counted[]; perDay: { dateKey: string; counts: Record<DeviceClass, number> }[] }
  landing: { pages: Counted[]; bySourceAndPage: { source: string; page: string; count: number }[]; sources: Counted[] }
  perVisitorDay: {
    pageViews: { average: number; median: number }
    linkClicks: { average: number; median: number }
  }
  destinations: { outboundHosts: Counted[]; internalClicks: Counted[] }
  people: PersonRow[]
  application: {
    jobPageViews: number
    jobSearchViews: number
    otherViews: number
    visitorsViewingJobPage: number
    visitorsClickingApply: number
    applyClicks: number
    avgJobPagesPerVisitorDay: number
    applyDestinations: Counted[]
  }
  leadGen: {
    pageViews: number
    clicks: number
    visitorsReaching: number
    avgClicksPerVisitorDay: number
    avgClicksPerVisitorDayAmongReachers: number
    byEntry: Counted[]
    perDay: { dateKey: string; clicks: number; visitors: number; perVisitor: number }[]
  }
}

// Routes that belong to the lead-gen flow: the persona journeys, the resume and
// search-firm submit forms, membership, sign-up, and the booking redirect.
export const LEAD_GEN_PREFIXES = ['/start', '/submit-resume', '/submit-search', '/membership', '/auth/signup', '/book']

const JOB_PAGE = /^\/jobs\/[^/?#]+/
// A click is attributed to the page the same visitor last viewed, if that was
// recent — LINK_CLICK rows carry no page of their own.
const CLICK_ATTRIBUTION_WINDOW_MS = 30 * 60 * 1000

export function pathOnly(path: string | null): string {
  if (!path) return '/'
  const cut = path.search(/[?#]/)
  const p = cut === -1 ? path : path.slice(0, cut)
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p || '/'
}

// Collapses the thousands of distinct job ids into one row so the landing-page
// table reads as pages, not as a list of job ids.
export function pageLabel(path: string | null): string {
  const p = pathOnly(path)
  return JOB_PAGE.test(p) ? '/jobs/[job posting]' : p
}

export function isJobPostingPath(path: string | null): boolean {
  return JOB_PAGE.test(pathOnly(path))
}

export function isLeadGenPath(path: string): boolean {
  return LEAD_GEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

const OWN_HOSTS = ['launchyournextchapter.com', 'localhost']

// Resolves a clicked href to { external host } or { internal path }.
export function describeHref(href: string | null): { host: string } | { internal: string } | null {
  if (!href) return null
  const trimmed = href.trim()
  if (trimmed.startsWith('/')) return { internal: pathOnly(trimmed) }
  if (/^(mailto|tel|sms):/i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    if (OWN_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) return { internal: pathOnly(url.pathname) }
    return { host: host.replace(/^www\./, '') }
  } catch {
    return null
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function rank(map: Map<string, number>, limit = 15): Counted[] {
  return Array.from(map, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}

export function analyzeVisits(
  events: VisitEvent[],
  options: { dayKey: (d: Date) => string; dateKeys: string[] }
): VisitorAnalytics {
  const { dayKey, dateKeys } = options
  const sorted = events.filter((e) => e.ip).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  type VisitorDay = {
    ip: string
    dateKey: string
    device: DeviceClass
    pageViews: number
    linkClicks: number
    jobPages: number
    leadGenClicks: number
    reachedLeadGen: boolean
    appliedClick: boolean
    viewedJob: boolean
    firstView: VisitEvent | null
  }
  const days = new Map<string, VisitorDay>()
  const lastView = new Map<string, VisitEvent>() // ip -> most recent page view
  const peopleMap = new Map<string, { pages: Map<string, number>; pageViews: number; linkClicks: number; last: Date; candidateId: string | null }>()

  const outbound = new Map<string, number>()
  const internalClicks = new Map<string, number>()
  const applyDestinations = new Map<string, number>()
  const leadGenEntry = new Map<string, number>()
  const jobPagesByDay = new Map<string, Set<string>>() // visitor-day key -> distinct job paths
  let pageViews = 0
  let linkClicks = 0
  let jobPageViews = 0
  let jobSearchViews = 0
  let otherViews = 0
  let applyClicks = 0
  let leadGenPageViews = 0
  let leadGenClicks = 0

  for (const e of sorted) {
    const ip = e.ip as string
    const dateKey = dayKey(e.createdAt)
    const dayId = `${ip}|${dateKey}`
    let day = days.get(dayId)
    if (!day) {
      day = {
        ip,
        dateKey,
        device: classifyDevice(e.userAgent),
        pageViews: 0,
        linkClicks: 0,
        jobPages: 0,
        leadGenClicks: 0,
        reachedLeadGen: false,
        appliedClick: false,
        viewedJob: false,
        firstView: null,
      }
      days.set(dayId, day)
    }
    const person = peopleMap.get(ip) ?? { pages: new Map(), pageViews: 0, linkClicks: 0, last: e.createdAt, candidateId: null }
    peopleMap.set(ip, person)
    person.last = e.createdAt
    if (e.candidateId) person.candidateId = e.candidateId

    if (e.eventType === 'PAGE_VIEW') {
      const p = pathOnly(e.path)
      pageViews++
      day.pageViews++
      person.pageViews++
      bump(person.pages, pageLabel(e.path))
      if (!day.firstView) day.firstView = e
      lastView.set(ip, e)

      if (isJobPostingPath(p)) {
        jobPageViews++
        day.viewedJob = true
        const set = jobPagesByDay.get(dayId) ?? new Set<string>()
        set.add(p)
        jobPagesByDay.set(dayId, set)
      } else if (p === '/jobs') {
        jobSearchViews++
      } else {
        otherViews++
      }
      if (isLeadGenPath(p)) {
        leadGenPageViews++
        day.reachedLeadGen = true
      }
    } else {
      linkClicks++
      day.linkClicks++
      person.linkClicks++
      const target = describeHref(e.href)
      const from = lastView.get(ip)
      const fromRecent = from && e.createdAt.getTime() - from.createdAt.getTime() <= CLICK_ATTRIBUTION_WINDOW_MS ? from : null
      if (target && 'host' in target) {
        bump(outbound, target.host)
        if (fromRecent && isJobPostingPath(fromRecent.path)) {
          applyClicks++
          day.appliedClick = true
          bump(applyDestinations, target.host)
        }
      } else if (target) {
        bump(internalClicks, target.internal)
        if (isLeadGenPath(target.internal)) {
          leadGenClicks++
          day.leadGenClicks++
          day.reachedLeadGen = true
          bump(leadGenEntry, target.internal.split('/').slice(0, 2).join('/') || '/')
        }
      }
    }
  }

  const dayList = Array.from(days.entries())
  const visitorDays = dayList.length
  for (const [id, set] of jobPagesByDay) {
    const d = days.get(id)
    if (d) d.jobPages = set.size
  }

  // device
  const deviceOverall = new Map<string, number>()
  const devicePerDay = new Map<string, Record<DeviceClass, number>>()
  for (const key of dateKeys) devicePerDay.set(key, { Mobile: 0, Tablet: 0, Desktop: 0, Unknown: 0 })
  for (const [, d] of dayList) {
    bump(deviceOverall, d.device)
    const row = devicePerDay.get(d.dateKey)
    if (row) row[d.device]++
  }

  // landing pages & sources (first page view of each visitor-day)
  const landing = new Map<string, number>()
  const sourceTotals = new Map<string, number>()
  const sourcePage = new Map<string, number>()
  for (const [, d] of dayList) {
    if (!d.firstView) continue
    const page = pageLabel(d.firstView.path)
    const source = trafficSourceGroup(classifyTrafficSource(d.firstView.path, d.firstView.referrer))
    bump(landing, page)
    bump(sourceTotals, source)
    bump(sourcePage, `${source}\u0000${page}`)
  }
  const bySourceAndPage = Array.from(sourcePage, ([k, count]) => {
    const [source, page] = k.split('\u0000')
    return { source, page, count }
  })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // people clicking on multiple pages
  const people: PersonRow[] = Array.from(peopleMap, ([ip, p]) => ({
    ip,
    distinctPages: p.pages.size,
    pageViews: p.pageViews,
    linkClicks: p.linkClicks,
    lastSeen: p.last,
    candidateId: p.candidateId,
    topPages: Array.from(p.pages, ([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)
      .map((x) => x.label),
  }))
    .filter((p) => p.distinctPages >= 2)
    .sort((a, b) => b.distinctPages - a.distinctPages || b.pageViews - a.pageViews)

  // lead gen per day
  const perDayLead = dateKeys.map((dateKey) => {
    const ofDay = dayList.filter(([, d]) => d.dateKey === dateKey)
    const clicks = ofDay.reduce((s, [, d]) => s + d.leadGenClicks, 0)
    return { dateKey, clicks, visitors: ofDay.length, perVisitor: ofDay.length ? clicks / ofDay.length : 0 }
  })
  const reachers = dayList.filter(([, d]) => d.reachedLeadGen)

  return {
    visitors: new Set(sorted.map((e) => e.ip)).size,
    visitorDays,
    pageViews,
    linkClicks,
    device: {
      overall: rank(deviceOverall),
      perDay: dateKeys.map((dateKey) => ({ dateKey, counts: devicePerDay.get(dateKey) as Record<DeviceClass, number> })),
    },
    landing: { pages: rank(landing, 20), bySourceAndPage, sources: rank(sourceTotals) },
    perVisitorDay: {
      pageViews: { average: average(dayList.map(([, d]) => d.pageViews)), median: median(dayList.map(([, d]) => d.pageViews)) },
      linkClicks: { average: average(dayList.map(([, d]) => d.linkClicks)), median: median(dayList.map(([, d]) => d.linkClicks)) },
    },
    destinations: { outboundHosts: rank(outbound, 15), internalClicks: rank(internalClicks, 15) },
    people,
    application: {
      jobPageViews,
      jobSearchViews,
      otherViews,
      visitorsViewingJobPage: dayList.filter(([, d]) => d.viewedJob).length,
      visitorsClickingApply: dayList.filter(([, d]) => d.appliedClick).length,
      applyClicks,
      avgJobPagesPerVisitorDay: average(dayList.map(([, d]) => d.jobPages)),
      applyDestinations: rank(applyDestinations, 15),
    },
    leadGen: {
      pageViews: leadGenPageViews,
      clicks: leadGenClicks,
      visitorsReaching: reachers.length,
      avgClicksPerVisitorDay: visitorDays ? leadGenClicks / visitorDays : 0,
      avgClicksPerVisitorDayAmongReachers: reachers.length ? reachers.reduce((s, [, d]) => s + d.leadGenClicks, 0) / reachers.length : 0,
      byEntry: rank(leadGenEntry),
      perDay: perDayLead,
    },
  }
}
