import 'server-only'
import { prisma } from '@/lib/prisma'

// A B2B lead is an organization reaching out, counted by day: an interested or referral reply to our cold email, a page claim, an
// employer statement with a verified work email, a recruiter or firm search request, or an audit request. The goal is 3 to 5 a day.

export const B2B_DAILY_TARGET = { low: 3, high: 5 }
const TZ = 'America/New_York'

export type B2bSource = 'interested' | 'claims' | 'statements' | 'searches' | 'audits'
export const B2B_SOURCE_LABEL: Record<B2bSource, string> = {
  interested: 'Interested replies to our emails',
  claims: 'Page claims',
  statements: 'Employer statements (verified email)',
  searches: 'Search requests',
  audits: 'Audit requests',
}

export interface B2bDay { date: string; total: number; bySource: Record<B2bSource, number> }
export type B2bDates = Record<B2bSource, Date[]>

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const empty = (): Record<B2bSource, number> => ({ interested: 0, claims: 0, statements: 0, searches: 0, audits: 0 })

/** The last `days` days (oldest first, ending today, Eastern time) with the leads of each kind. Pure, so it is tested. */
export function bucketB2b(dates: B2bDates, days: number, now = new Date()): B2bDay[] {
  const out: B2bDay[] = []
  const index = new Map<string, B2bDay>()
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(new Date(now.getTime() - i * 86_400_000))
    const d: B2bDay = { date, total: 0, bySource: empty() }
    out.push(d)
    index.set(date, d)
  }
  for (const source of Object.keys(dates) as B2bSource[]) {
    for (const at of dates[source]) {
      const d = index.get(dayKey(at))
      if (!d) continue
      d.bySource[source]++
      d.total++
    }
  }
  return out
}

/** Last-7-days average per day, excluding today (a day still in progress). */
export function weekAverage(days: B2bDay[]): number {
  const week = days.slice(-8, -1)
  return week.length ? week.reduce((n, d) => n + d.total, 0) / week.length : 0
}

async function dates(label: string, read: () => Promise<{ at: Date | null }[]>): Promise<Date[]> {
  try {
    return (await read()).flatMap((r) => (r.at ? [r.at] : []))
  } catch (e) {
    console.error(`b2b leads: ${label} unavailable:`, e instanceof Error ? e.message : e)
    return []
  }
}

/** `interested` comes from the cold-email report the page already loaded; the rest are read here. */
export async function loadB2b(interested: Date[], days = 14): Promise<B2bDay[]> {
  const since = new Date(Date.now() - (days + 1) * 86_400_000)
  const [claims, statements, searches, audits] = await Promise.all([
    dates('claims', () => prisma.orgClaim.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }).then((r) => r.map((x) => ({ at: x.createdAt })))),
    dates('statements', () => prisma.employerStatement.findMany({ where: { emailVerifiedAt: { gte: since } }, select: { emailVerifiedAt: true } }).then((r) => r.map((x) => ({ at: x.emailVerifiedAt })))),
    dates('searches', () => prisma.searchRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }).then((r) => r.map((x) => ({ at: x.createdAt })))),
    dates('audits', () => prisma.auditRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }).then((r) => r.map((x) => ({ at: x.createdAt })))),
  ])
  return bucketB2b({ interested, claims, statements, searches, audits }, days)
}
