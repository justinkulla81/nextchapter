// Application analytics for My jobs (Teal parity, 2026-10-23): how many applications went out, how
// many got any reply, an interview or an offer, and the same rates by job function and level so a
// member can see where their applications land. Pure; function and level come from the job title
// with the same keyword rules the board uses. Tests: src/test/application-analytics.test.ts.

import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'

export interface AnalyticsApplication {
  title: string | null
  appliedAt: Date | null
  interviewLandedAt: Date | null
  offerReceivedAt: Date | null
  declinedAt: Date | null
  /** 'COMPANY' | 'CANDIDATE' | null. A member passing is not a reply from the employer. */
  declinedBy: string | null
}

export interface RateRow {
  label: string
  applied: number
  replied: number
  interviews: number
  /** Replies (interview, offer or a rejection from the employer) per application, 0-100. */
  replyRate: number
  interviewRate: number
}

export interface ApplicationAnalytics {
  applied: number
  appliedLast7: number
  appliedLast30: number
  replied: number
  interviews: number
  offers: number
  /** Null until there are enough applications for a rate to mean something. */
  replyRate: number | null
  interviewRate: number | null
  /** Offers per interview. */
  offerRate: number | null
  byFunction: RateRow[]
  byLevel: RateRow[]
}

/** Rates show from this many applications; a group row from this many in the group. */
export const MIN_FOR_RATES = 5
export const MIN_PER_GROUP = 2
const MAX_ROWS = 5
const DAY_MS = 86_400_000

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0)

export function gotReply(a: AnalyticsApplication): boolean {
  return !!a.interviewLandedAt || !!a.offerReceivedAt || (!!a.declinedAt && a.declinedBy !== 'CANDIDATE')
}

/** 'Director', 'VP', 'C-Suite', 'Manager', 'IC' from the title, said plainly. */
const LEVEL_LABEL: Record<string, string> = { IC: 'Individual contributor' }

function rows(apps: AnalyticsApplication[], labelOf: (a: AnalyticsApplication) => string | null): RateRow[] {
  const groups = new Map<string, AnalyticsApplication[]>()
  for (const a of apps) {
    const label = labelOf(a)
    if (!label) continue
    groups.set(label, [...(groups.get(label) ?? []), a])
  }
  return [...groups.entries()]
    .filter(([, g]) => g.length >= MIN_PER_GROUP)
    .map(([label, g]) => {
      const replied = g.filter(gotReply).length
      const interviews = g.filter((a) => a.interviewLandedAt || a.offerReceivedAt).length
      return { label, applied: g.length, replied, interviews, replyRate: pct(replied, g.length), interviewRate: pct(interviews, g.length) }
    })
    .sort((x, y) => y.applied - x.applied || y.replyRate - x.replyRate || x.label.localeCompare(y.label))
    .slice(0, MAX_ROWS)
}

export function applicationAnalytics(all: AnalyticsApplication[], now: Date): ApplicationAnalytics {
  const apps = all.filter((a) => a.appliedAt)
  const replied = apps.filter(gotReply).length
  const interviews = apps.filter((a) => a.interviewLandedAt || a.offerReceivedAt).length
  const offers = apps.filter((a) => a.offerReceivedAt).length
  const enough = apps.length >= MIN_FOR_RATES
  const since = (days: number) => apps.filter((a) => now.getTime() - a.appliedAt!.getTime() <= days * DAY_MS).length
  return {
    applied: apps.length,
    appliedLast7: since(7),
    appliedLast30: since(30),
    replied,
    interviews,
    offers,
    replyRate: enough ? pct(replied, apps.length) : null,
    interviewRate: enough ? pct(interviews, apps.length) : null,
    offerRate: interviews > 0 && enough ? pct(offers, interviews) : null,
    byFunction: rows(apps, (a) => (a.title ? inferFunctionFromTitle(a.title) : null)),
    byLevel: rows(apps, (a) => {
      if (!a.title) return null
      const level = inferLevelFromTitle(a.title)
      return LEVEL_LABEL[level] ?? level
    }),
  }
}
